"""Smooth 30-second JJS rooftop loop using the approved mobile neon artwork.

Dependencies: Python, NumPy, OpenCV, FFmpeg.
The source is the original 910x512 landscape footage; the reference is the
approved 941x1672 mobile artwork. All editing happens as video compositing.
"""
import argparse
import json
from pathlib import Path
import subprocess

import cv2
import numpy as np

cv2.setNumThreads(2)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--reference', type=Path, required=True)
parser.add_argument('--audio', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--coarse-transforms', type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)

cap = cv2.VideoCapture(str(args.source))
count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
assert (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))) == (910, 512)
cap.set(cv2.CAP_PROP_POS_FRAMES, 60)
ok, reference_frame = cap.read()
assert ok
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

# First align the real building to a fixed reference, then refine each coarse
# feature match against all of the building's image texture. The refinement
# removes the frame-to-frame scale/rotation noise of the previous ORB-only fit.
x, y, w, h = 325, 155, 140, 245
template = cv2.cvtColor(reference_frame[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
coarse = np.load(args.coarse_transforms) if args.coarse_transforms else None
if coarse is not None:
    assert len(coarse) == count
orb = cv2.ORB_create(nfeatures=1600, edgeThreshold=8, fastThreshold=8)
mask = np.zeros((512, 910), np.uint8)
mask[140:420, 315:465] = 255
kp_ref, desc_ref = orb.detectAndCompute(cv2.cvtColor(reference_frame, cv2.COLOR_BGR2GRAY), mask)
matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
origin = np.array([[1., 0., x], [0., 1., y], [0., 0., 1.]])
last_coarse = np.eye(2, 3, dtype=np.float32)
matrices, correlations, translations = [], [], []
for idx in range(count):
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Unreadable source frame {idx}')
    if coarse is not None:
        base = coarse[idx]
    else:
        kp, desc = orb.detectAndCompute(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), None)
        if desc is not None:
            pairs = matcher.knnMatch(desc_ref, desc, k=2)
            good = [a for pair in pairs if len(pair) == 2 for a, b in [pair] if a.distance < .72*b.distance]
            if len(good) > 8:
                src = np.float32([kp[m.trainIdx].pt for m in good])
                dst = np.float32([kp_ref[m.queryIdx].pt for m in good])
                found, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2)
                if found is not None and inliers.sum() > 7:
                    last_coarse = found
        base = last_coarse
    candidate = cv2.warpAffine(frame, base, (910, 512), flags=cv2.INTER_CUBIC)
    patch = cv2.cvtColor(candidate[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
    cc, local = cv2.findTransformECC(template, patch, np.eye(2, 3, dtype=np.float32),
        cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 60, 1e-6), None, 5)
    if cc < .98:
        raise RuntimeError(f'Unreliable rooftop alignment at frame {idx}: {cc}')
    correction = origin @ np.linalg.inv(np.vstack([local, [0, 0, 1]])) @ np.linalg.inv(origin)
    refined = correction @ np.vstack([base, [0, 0, 1]])
    matrices.append(refined[:2].astype(np.float32))
    correlations.append(float(cc))
    # Independent residual translation measurement, after the refined alignment.
    if idx % 10 == 0:
        aligned = cv2.warpAffine(frame, refined[:2], (910, 512), flags=cv2.INTER_CUBIC)
        crop = cv2.cvtColor(aligned[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
        _, check = cv2.findTransformECC(template, crop, np.eye(2, 3, dtype=np.float32),
            cv2.MOTION_TRANSLATION, (cv2.TERM_CRITERIA_COUNT | cv2.TERM_CRITERIA_EPS, 30, 1e-6), None, 5)
        translations.append(check[:, 2].tolist())
    if idx % 150 == 0:
        print(f'Aligned {idx}/{count}', flush=True)
cap.release()
matrices = np.array(matrices)
np.save(args.output/'refined-transforms.npy', matrices)

# The sign and glow are reused from the approved mobile artwork, not regenerated.
still = cv2.imread(str(args.reference))
plate = still[210:355, 328:718].astype(np.float32)
signal = np.maximum(plate - np.array([34, 25, 19], dtype=np.float32), 0)
signal *= np.clip((signal.max(axis=2) - 5) / 12, 0, 1)[..., None]
edge_x = np.minimum(np.arange(390), np.arange(390)[::-1])
edge_y = np.minimum(np.arange(145), np.arange(145)[::-1])
signal *= np.minimum(np.clip(edge_x/4, 0, 1)[None, :],
                     np.clip(edge_y/4, 0, 1)[:, None])[..., None]

W, H, fps, frames = 1920, 1080, 60, 1800
video_path = args.output/'JJS-Desktop-Smooth-Neon-30s.mp4'
command = ['ffmpeg', '-y', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'bgr24',
    '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-i', str(args.audio),
    '-map', '0:v', '-map', '1:a', '-af',
    'volume=0.45,afade=t=in:d=0.6,afade=t=out:st=29.2:d=0.8',
    '-t', '30', '-c:v', 'libx264', '-preset', 'fast', '-threads', '4',
    '-crf', '21', '-maxrate', '2500k', '-bufsize', '5000k',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    str(video_path), '-loglevel', 'error']
encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
cap = cv2.VideoCapture(str(args.source))
cache = {}
next_read = 0
first_stable = None

def get_stable(idx):
    global next_read, first_stable
    while next_read <= idx:
        ok, f = cap.read()
        if not ok:
            raise RuntimeError(f'Unreadable render frame {next_read}')
        stable = cv2.warpAffine(f, matrices[next_read], (910, 512), flags=cv2.INTER_CUBIC,
                               borderMode=cv2.BORDER_REFLECT)
        cache[next_read] = stable.astype(np.float32)
        if next_read == 0:
            first_stable = cache[0].copy()
        next_read += 1
    return cache[idx]

for i in range(frames):
    source_time = i * (count-1)/(frames-1)
    a, b = int(source_time), min(count-1, int(source_time)+1)
    fraction = source_time-a
    # Time interpolation avoids the repeated source frames that caused judder
    # when a 28-second clip was simply stretched to thirty seconds.
    stable = get_stable(a)*(1-fraction) + get_stable(b)*fraction
    t = i/(frames-1)
    # Smoothly close the real footage's tiny lighting difference at the seam.
    if t > .965:
        mix = (t-.965)/.035
        mix = mix*mix*(3-2*mix)
        stable = stable*(1-mix) + first_stable*mix
    # A visible 53% push toward the logo and gentle return forms a seamless loop.
    eased = .5-.5*np.cos(2*np.pi*t)
    z = 1.18+.62*eased
    scale = W*z/910
    left = 390-910/z*.5
    top = 12-18*eased
    camera = np.array([[scale, 0, -left*scale], [0, scale, -top*scale]], np.float32)
    canvas = cv2.warpAffine(stable, camera, (W, H), flags=cv2.INTER_LANCZOS4,
                            borderMode=cv2.BORDER_REFLECT)
    # Floating-point placement removes the previous one-pixel steps in the sign.
    sign_scale = scale*150/390
    tx, ty = (314-left)*scale, (76-top)*scale
    ox, oy = int(np.floor(tx))-3, int(np.floor(ty))-3
    sw, sh = int(np.ceil(390*sign_scale))+7, int(np.ceil(145*sign_scale))+7
    sign_camera = np.array([[sign_scale, 0, tx-ox], [0, sign_scale, ty-oy]], np.float32)
    neon = cv2.warpAffine(signal, sign_camera, (sw, sh), flags=cv2.INTER_CUBIC)
    neon = np.clip(neon, 0, 255)
    region = canvas[oy:oy+sh, ox:ox+sw]
    canvas[oy:oy+sh, ox:ox+sw] = region+neon*(1-region/255)
    canvas = np.clip(canvas, 0, 255).astype(np.uint8)
    encoder.stdin.write(canvas.tobytes())
    if i in (0, 450, 900, 1350, 1799):
        cv2.imwrite(str(args.output/f'check-{i}.jpg'), canvas)
    for old in [k for k in cache if k < a]:
        del cache[old]
    if i % 300 == 0:
        print(f'Rendered {i}/{frames}', flush=True)
encoder.stdin.close()
encoder.wait()
cap.release()
if encoder.returncode:
    raise RuntimeError('Encoder failed')
diagnostics = {
    'duration_seconds': 30, 'fps': fps, 'frames': frames,
    'minimum_rooftop_correlation': min(correlations),
    'median_rooftop_correlation': float(np.median(correlations)),
    'residual_translation_p95_source_pixels': np.percentile(np.abs(translations), 95, axis=0).tolist(),
    'residual_translation_max_source_pixels': np.max(np.abs(translations), axis=0).tolist(),
    'zoom_size_increase_percent': round((1.8/1.18-1)*100, 1),
    'loop_closes_at_starting_framing': True,
}
(args.output/'validation.json').write_text(json.dumps(diagnostics, indent=2)+'\n')
print(json.dumps(diagnostics), flush=True)
