"""Restore the original real-time street footage under approved fixed signage.

Camera registration affects only the road/sidewalk mask. The approved scene,
building, sign treatment and 25.5-second timing stay fixed. No generated motion,
reversed traffic, slow motion or frame blending is used. Both daytime audio
tracks are reduced by another 6 dB during export.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile

import cv2
import numpy as np

cv2.setNumThreads(2)
APPROVED_SHA = '24fa188db107f3bd3a40d313438dc08e13e39ad1f039e4b81f3b32fb64de0057'
SIZE = (2160, 3840)
NATIVE = (512, 910)
SCALE = np.diag([SIZE[0]/NATIVE[0], SIZE[1]/NATIVE[1], 1.])
BOX = (1265, 2616, 2160, 3629)
POLYGON = [[315,635],[355,642],[511,741],[511,838],
           [437,803],[376,759],[319,751],[312,729],[319,698],[325,670]]


def track(source, base, count, work):
    cache = work / 'street-registration.npy'
    if cache.exists():
        matrices = np.load(cache)
        assert matrices.shape == (count, 3, 3)
        return matrices
    target = cv2.resize(base, NATIVE, interpolation=cv2.INTER_AREA)
    mask = np.zeros((910,512), np.uint8)
    mask[250:820,135:505] = 255
    sift = cv2.SIFT_create(nfeatures=3000)
    kt, dt = sift.detectAndCompute(cv2.cvtColor(target,cv2.COLOR_BGR2GRAY), mask)
    matcher = cv2.BFMatcher()
    cap = cv2.VideoCapture(str(source))
    result, quality = [], []
    for i in range(count):
        ok, frame = cap.read()
        assert ok, i
        keys, desc = sift.detectAndCompute(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), mask)
        good = [a for a,b in matcher.knnMatch(desc,dt,k=2) if a.distance < .72*b.distance]
        before = np.float32([keys[m.queryIdx].pt for m in good])
        after = np.float32([kt[m.trainIdx].pt for m in good])
        H, inliers = cv2.findHomography(before,after,cv2.RANSAC,1.5)
        assert H is not None and int(inliers.sum()) > 150, (i, len(good))
        error = np.linalg.norm(cv2.perspectiveTransform(before[:,None],H)[:,0]-after,axis=1)
        median = float(np.median(error[inliers[:,0]>0]))
        assert median < .65, (i,median)
        result.append(H)
        quality.append({'frame':i,'inliers':int(inliers.sum()),'median_error_native_px':median})
        if i%150 == 0:
            print(f'Registering street: {i}/{count}', flush=True)
    cap.release()
    matrices = np.asarray(result)
    np.save(cache,matrices)
    (work/'tracking-quality.json').write_text(json.dumps(quality,indent=2)+'\n')
    return matrices


def mask():
    full = np.zeros((SIZE[1],SIZE[0]),np.uint8)
    poly = np.array(POLYGON) * np.array([SIZE[0]/512,SIZE[1]/910])
    cv2.fillPoly(full,[poly.astype(np.int32)],255)
    # The feather is outside vehicle paths; original road users stay opaque.
    full = cv2.GaussianBlur(full.astype(np.float32)/255,(0,0),7)
    x0,y0,x1,y1 = BOX
    return full[y0:y1,x0:x1,None]


def composite(base,source,H,alpha):
    x0,y0,x1,y1 = BOX
    T = np.array([[1.,0,-x0],[0,1,-y0],[0,0,1.]]) @ SCALE @ H
    street = cv2.warpPerspective(source,T,(x1-x0,y1-y0),flags=cv2.INTER_LANCZOS4)
    coverage = cv2.warpPerspective(np.ones(source.shape[:2],np.uint8),T,(x1-x0,y1-y0),flags=cv2.INTER_NEAREST)
    assert float(coverage[alpha[:,:,0]>.95].mean()) > .999
    old = base[y0:y1,x0:x1]
    # Robustly match the static paving, excluding the feather and image borders.
    valid = (alpha[:,:,0]>.95) & (coverage>0)
    offset = np.median((old.astype(np.float32)-street.astype(np.float32))[valid],axis=0)
    offset = np.clip(offset,-8,8)
    street = np.clip(street.astype(np.float32)+offset,0,255)
    base[y0:y1,x0:x1] = np.clip(old*(1-alpha)+street*alpha,0,255).astype(np.uint8)
    return base


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--approved',type=Path,required=True)
    p.add_argument('--output',type=Path)
    p.add_argument('--work',type=Path,required=True)
    p.add_argument('--preview',action='store_true')
    a=p.parse_args()
    assert hashlib.sha256(a.approved.read_bytes()).hexdigest()==APPROVED_SHA
    a.work.mkdir(parents=True,exist_ok=True)
    cap=cv2.VideoCapture(str(a.approved));ok,base=cap.read();assert ok
    count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));fps=cap.get(cv2.CAP_PROP_FPS);cap.release()
    assert count==765 and fps==30
    matrices=track(a.source,base,count,a.work)
    alpha=mask()
    cv2.imwrite(str(a.work/'street-mask.png'),np.uint8(alpha[:,:,0]*255))
    orig=cv2.VideoCapture(str(a.source));shots=[]
    for i in [0,90,180,360,540,720,764]:
        orig.set(cv2.CAP_PROP_POS_FRAMES,i);ok,f=orig.read();assert ok
        done=composite(base.copy(),f,matrices[i],alpha)
        cv2.imwrite(str(a.work/f'preview-{i}.jpg'),done,[cv2.IMWRITE_JPEG_QUALITY,95])
        shot=cv2.resize(done,(540,960),interpolation=cv2.INTER_AREA)[620:910]
        cv2.putText(shot,f'{i/fps:.1f}s',(10,25),cv2.FONT_HERSHEY_SIMPLEX,.65,(255,255,255),2)
        shots.append(shot)
    orig.release()
    cv2.imwrite(str(a.work/'natural-street-sequence.jpg'),np.hstack(shots),[cv2.IMWRITE_JPEG_QUALITY,96])
    if a.preview:return
    assert a.output
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='jjs-natural-street-') as temp:
        dest=Path(temp)/'complete.mp4'
        cmd=['ffmpeg','-nostdin','-y','-v','warning','-f','rawvideo','-pix_fmt','bgr24',
             '-s','2160x3840','-r','30','-i','pipe:0','-i',str(a.approved),
             '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-threads','6',
             '-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-af','volume=-6dB',
             '-t','25.5','-movflags','+faststart',str(dest)]
        encoder=subprocess.Popen(cmd,stdin=subprocess.PIPE)
        orig=cv2.VideoCapture(str(a.source));approved=cv2.VideoCapture(str(a.approved))
        for i in range(count):
            ok,live=orig.read();assert ok;ok,frame=approved.read();assert ok
            encoder.stdin.write(composite(frame,live,matrices[i],alpha).tobytes())
            if i%150==0:print(f'Encoding natural street: {i}/{count}',flush=True)
        encoder.stdin.close();assert encoder.wait()==0
        orig.release();approved.release()
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
             '-show_entries','stream=width,height,nb_frames,r_frame_rate,duration','-of','json',str(dest)]))['streams'][0]
        assert (info['width'],info['height'],int(info['nb_frames']))==(2160,3840,765)
        partial=a.output.with_suffix('.complete');shutil.copyfile(dest,partial);partial.replace(a.output)
    report={'approved_sha256':APPROVED_SHA,'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),
            'output_sha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'video':info,'audio_gain_db':-6,
            'motion':'original source frames 0–764 at 30 fps; no interpolation, reversing or slow motion',
            'changed_area':{'box':BOX,'native_polygon':POLYGON},'building_and_signs':'outside the moving footage mask'}
    (a.work/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)


if __name__=='__main__':main()
