"""Composite the approved mobile neon sign into stabilized landscape footage."""
import cv2
import numpy as np
import subprocess
from pathlib import Path

cv2.setNumThreads(2)
import argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True, help='Original 910x512 landscape footage')
parser.add_argument('--reference', type=Path, required=True, help='Approved 941x1672 mobile reference artwork')
parser.add_argument('--audio', type=Path, required=True, help='Approved quiet traffic and distant siren MP3')
parser.add_argument('--output', type=Path, required=True, help='Directory for the rendered film and QA frames')
args = parser.parse_args()
out = args.output
out.mkdir(parents=True, exist_ok=True)
source = args.source
reference = args.reference

# Reuse the approved neon lettering and its photographed blue/gold glow.
# This is the actual sign plate used to create the approved mobile film.
still = cv2.imread(str(reference))
sign = still[210:355, 328:718].astype(np.float32)
# Screen compositing removes the dark reference sky without replacing the
# desktop skyline. The blue-white tubes and gold date remain unchanged.
sky = np.array([34, 25, 19], dtype=np.float32)
signal = np.maximum(sign - sky, 0)
strength = signal.max(axis=2)
signal *= np.clip((strength - 5) / 12, 0, 1)[..., None]
edge_x = np.minimum(np.arange(390), np.arange(390)[::-1])
edge_y = np.minimum(np.arange(145), np.arange(145)[::-1])
feather = np.minimum(np.clip(edge_x / 4, 0, 1)[None, :],
                     np.clip(edge_y / 4, 0, 1)[:, None])
signal *= feather[..., None]

cap = cv2.VideoCapture(str(source))
count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cap.set(cv2.CAP_PROP_POS_FRAMES, 60)
ok, ref = cap.read()
assert ok
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
mask = np.zeros((512, 910), np.uint8)
mask[140:420, 315:465] = 255
orb = cv2.ORB_create(nfeatures=1600, edgeThreshold=8, fastThreshold=8)
kp_ref, desc_ref = orb.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), mask)
matcher = cv2.BFMatcher(cv2.NORM_HAMMING)

W, H = 1920, 1080
cmd = ['ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'bgr24',
       '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-i', str(args.audio),
       '-map', '0:v', '-map', '1:a', '-af',
       'volume=0.45,afade=t=in:d=0.6,afade=t=out:st=29.2:d=0.8',
       '-t', '30', '-c:v', 'libx264', '-preset', 'fast', '-threads', '4', '-crf', '19',
       '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
       str(out/'JJS-Desktop-Mobile-Matched-Neon-30s.mp4'), '-loglevel', 'error']
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
last = np.eye(2, 3, dtype=np.float32)
cached = -1
next_index = 0
transforms = []
for i in range(900):
    idx = min(count-1, int(i*(count-1)/899))
    if idx != cached:
        assert idx == next_index
        ok, frame = cap.read()
        if not ok:
            raise RuntimeError(f'Could not read source frame {idx}')
        next_index += 1
        kp, desc = orb.detectAndCompute(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), None)
        if desc is not None:
            pairs = matcher.knnMatch(desc_ref, desc, k=2)
            good = [a for pair in pairs if len(pair) == 2 for a, b in [pair]
                    if a.distance < .72*b.distance]
            if len(good) > 8:
                src = np.float32([kp[m.trainIdx].pt for m in good])
                dst = np.float32([kp_ref[m.queryIdx].pt for m in good])
                mat, inliers = cv2.estimateAffinePartial2D(src, dst,
                    method=cv2.RANSAC, ransacReprojThreshold=2)
                if mat is not None and inliers.sum() > 7:
                    last = mat
        transforms.append(last.copy())
        stable = cv2.warpAffine(frame, last, (910, 512), flags=cv2.INTER_CUBIC,
                                borderMode=cv2.BORDER_REFLECT)
        cached = idx
    # A gentle 12% push over thirty seconds, without a hand-held camera shake.
    z = 1.38 + .17*(.5-.5*np.cos(np.pi*i/899))
    scale = W/(910/z)
    left = 390-910/z*.49
    top = 15
    camera = np.array([[scale, 0, -left*scale], [0, scale, -top*scale]], np.float32)
    canvas = cv2.warpAffine(stable, camera, (W, H), flags=cv2.INTER_LANCZOS4)
    sw = round(150*scale)
    sh = round(sw*145/390)
    x, y = round((314-left)*scale), round((76-top)*scale)
    neon = cv2.resize(signal, (sw, sh), interpolation=cv2.INTER_CUBIC)
    neon = np.clip(neon, 0, 255)
    region = canvas[y:y+sh, x:x+sw].astype(np.float32)
    canvas[y:y+sh, x:x+sw] = np.clip(region + neon*(1-region/255), 0, 255).astype(np.uint8)
    proc.stdin.write(canvas.tobytes())
    if i in (0, 450, 899):
        cv2.imwrite(str(out/f'check-{i}.jpg'), canvas)
    if i % 150 == 0:
        print(f'Rendered {i}/900', flush=True)
proc.stdin.close()
proc.wait()
cap.release()
np.save(out/'stabilization-transforms.npy', np.array(transforms))
if proc.returncode:
    raise RuntimeError('Video encoder failed')
print('Completed 30-second mobile-matched desktop neon film.', flush=True)
