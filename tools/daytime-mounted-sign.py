"""Fit the approved physical sign detail to the existing locked-off day film.

Only the sign and its immediate contact shadows are replaced. The camera,
traffic, reflections, loop length and quieter audio retain the approved master.
Desktop is encoded from its established 16:9 crop; mobile retains the full frame.
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
ROOT = Path(__file__).resolve().parent
SOURCE_SHA = '02c4876d3cf7ca562042012d3acc90e10d3c58d5cde77539ca654e4ae4b71e3e'
ORIGIN = (650, 470)
REF_SIZE = (860, 360)


def prepare(work):
    generated = cv2.imread(str(ROOT / 'daytime-mounted-sign-data/approved-detail.png'))
    reference = cv2.imread(str(ROOT / 'daytime-mounted-sign-data/reference.png'))
    h, w = generated.shape[:2]
    target = cv2.resize(reference, (w, h), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    src = generated.astype(np.float32)
    sy, sx = h / REF_SIZE[1], w / REF_SIZE[0]
    # Exact facade planes, with enough clearance for the new letter returns.
    planes = np.zeros((h, w), np.uint8)
    for poly in [
        [[58, 76], [213, 83], [213, 212], [58, 204]],
        [[293, 65], [796, 89], [796, 212], [293, 181]],
    ]:
        cv2.fillConvexPoly(planes, np.int32(np.array(poly) * [sx, sy]), 1)

    def material(img):
        b, g, r = cv2.split(img)
        return ((r > b - 8) & (r > g * .87) & (r > 70)).astype(np.uint8) * planes

    core = np.maximum(material(src), material(target))
    radius = int(round(7 * sx))
    mask = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1,) * 2))
    # Match the blue glazing locally without changing ivory faces or gold metal.
    valid = (1 - cv2.dilate(core, np.ones((int(16*sx)|1,)*2, np.uint8))).astype(np.float32)
    residual = target - src
    sigma = 24 * sx
    weight = cv2.GaussianBlur(valid, (0, 0), sigma)
    correction = cv2.GaussianBlur(residual * valid[:, :, None], (0, 0), sigma) / np.maximum(weight[:, :, None], .01)
    warm = cv2.GaussianBlur(material(src).astype(np.float32), (0, 0), .55 * sx)
    warm = np.clip(warm * 1.6, 0, 1)
    corrected = np.clip(src + correction * (1 - warm[:, :, None]), 0, 255)
    alpha = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), .75 * sx)
    rgba = np.dstack([corrected, alpha * 255]).astype(np.uint8)
    cv2.imwrite(str(work / 'approved-sign-overlay.png'), rgba)
    return rgba


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--work', type=Path, required=True)
    p.add_argument('--output', type=Path)
    p.add_argument('--format', choices=['desktop', 'mobile'], default='mobile')
    p.add_argument('--preview', action='store_true')
    a = p.parse_args()
    assert hashlib.sha256(a.source.read_bytes()).hexdigest() == SOURCE_SHA
    a.work.mkdir(parents=True, exist_ok=True)
    rgba = prepare(a.work)
    cap = cv2.VideoCapture(str(a.source))
    ok, first = cap.read()
    assert ok
    count, fps = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    if a.format == 'desktop':
        # Equivalent to the approved 50% 12% object-fit crop at 16:9.
        width, height, scale, crop_y = 3840, 2160, 3840 / 2160, 315
        base = cv2.resize(first[crop_y:crop_y+1215], (width, height), interpolation=cv2.INTER_LANCZOS4)
        filters = 'crop=2160:1215:0:315,scale=3840:2160:flags=lanczos'
    else:
        width, height, scale, crop_y = 2160, 3840, 1., 0
        base = first.copy()
        filters = 'null'
    overlay = cv2.resize(rgba, (round(REF_SIZE[0]*scale), round(REF_SIZE[1]*scale)), interpolation=cv2.INTER_AREA)
    x, y = round(ORIGIN[0]*scale), round((ORIGIN[1]-crop_y)*scale)
    oh, ow = overlay.shape[:2]
    alpha = overlay[:, :, 3:4].astype(np.float32) / 255
    base[y:y+oh, x:x+ow] = np.clip(base[y:y+oh, x:x+ow] * (1-alpha) + overlay[:, :, :3]*alpha, 0, 255).astype(np.uint8)
    cv2.imwrite(str(a.work / f'daytime-{a.format}-mounted.jpg'), base, [cv2.IMWRITE_JPEG_QUALITY, 97])
    cv2.imwrite(str(a.work / f'daytime-{a.format}-detail.jpg'), base[max(0,y-20):y+oh+20, max(0,x-20):x+ow+20], [cv2.IMWRITE_JPEG_QUALITY, 98])
    overlay_path = a.work / f'overlay-{a.format}.png'
    cv2.imwrite(str(overlay_path), overlay)
    if a.preview:
        return
    assert a.output
    a.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=f'jjs-mounted-{a.format}-') as temp:
        encoded = Path(temp) / 'complete.mp4'
        cmd = ['ffmpeg', '-nostdin', '-y', '-v', 'warning', '-threads', '3', '-i', str(a.source),
               '-i', str(overlay_path), '-filter_complex_threads', '2',
               '-filter_complex', f'[0:v]{filters}[base];[base][1:v]overlay={x}:{y}:format=auto,format=yuv420p[out]',
               '-map', '[out]', '-map', '0:a:0', '-c:v', 'libx264', '-preset', 'fast', '-threads', '6',
               '-crf', '17', '-c:a', 'copy', '-movflags', '+faststart', str(encoded)]
        subprocess.run(cmd, check=True)
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height,nb_frames,r_frame_rate,duration', '-of', 'json', str(encoded)], text=True))['streams'][0]
        assert (info['width'], info['height'], int(info['nb_frames'])) == (width, height, count)
        partial = a.output.with_suffix('.complete')
        shutil.copyfile(encoded, partial)
        partial.replace(a.output)
    report = dict(source_sha256=SOURCE_SHA, approved_image_sha256=hashlib.sha256((ROOT/'daytime-mounted-sign-data/approved-detail.png').read_bytes()).hexdigest(),
                  output_sha256=hashlib.sha256(a.output.read_bytes()).hexdigest(), video=info, fps=fps,
                  audio='approved quieter audio bitstream copied unchanged', camera='approved locked-off source; fixed crop only')
    (a.work / f'{a.format}-validation.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
