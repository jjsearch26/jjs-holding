"""Hold the approved daytime building and signs to one rigid reference view.

The existing film contains local warping in the glass reflections. Replace only
the building silhouette with its approved opening frame; retain the surrounding
film, original 30 fps timing and existing quieter AAC bitstream. No optical-flow
warping, zoom, retiming or generated detail is introduced.
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
SOURCES = {
    'desktop': '0de7240558ea89f498482c9a19630672a0290ae709c45694fe06abf7a5979330',
    'mobile': 'e86ac3665cb6951ec1fedf63776bdf1ba8bba0e457c514a7b9dd5bcc5848fbbb',
}
# Points measured on a half-size reference; the outline includes both signs,
# all blue glazing, and the projecting brick side of this same building.
DESKTOP_OUTLINE = [[473, 353], [535, 220], [580, 222], [584, 195],
                [810, 218], [810, 190], [824, 177], [1294, 226],
                [1294, 1080], [473, 1080]]
MOBILE_OUTLINE = [[130, 175], [150, 140], [164, 141], [165, 133],
                  [228, 139], [228, 132], [232, 127], [365, 141],
                  [365, 501], [151, 506], [131, 500]]
FORMATS = {
    'desktop': ((3840, 2160), (936, 342, 2600, 2160), DESKTOP_OUTLINE, 2),
    'mobile': ((2160, 3840), (506, 494, 1474, 2040), MOBILE_OUTLINE, 4),
}


def building_alpha(size, box, outline, factor):
    mask = np.zeros((size[1], size[0]), np.uint8)
    cv2.fillPoly(mask, [np.int32(outline) * factor], 255)
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    mask = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 2)
    x0, y0, x1, y1 = box
    return mask[y0:y1, x0:x1, None]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--work', type=Path, required=True)
    p.add_argument('--format', choices=FORMATS, required=True)
    a = p.parse_args()
    source_sha = SOURCES[a.format]
    size, box, outline, factor = FORMATS[a.format]
    assert hashlib.sha256(a.source.read_bytes()).hexdigest() == source_sha
    a.work.mkdir(parents=True, exist_ok=True)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(a.source))
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    ok, reference = cap.read()
    assert ok and reference.shape[:2] == (size[1], size[0])
    assert count == 765 and fps == 30
    alpha = building_alpha(size, box, outline, factor)
    x0, y0, x1, y1 = box
    if a.format == 'mobile':
        # The natural road/sidewalk footage starts at y=2616. The rigid glass
        # plate ends at y=2040, leaving every road frame and its feather intact.
        assert y1 < 2616
    plate = reference[y0:y1, x0:x1].astype(np.float32)
    cv2.imwrite(str(a.work / 'building-mask.png'), np.uint8(alpha[:, :, 0] * 255))
    with tempfile.TemporaryDirectory(prefix='jjs-stable-facade-') as temporary:
        completed = Path(temporary) / 'complete.mp4'
        cmd = ['ffmpeg', '-nostdin', '-y', '-v', 'warning', '-f', 'rawvideo',
               '-pix_fmt', 'bgr24', '-s', f'{size[0]}x{size[1]}', '-r', '30', '-i', 'pipe:0',
               '-i', str(a.source), '-map', '0:v:0', '-map', '1:a:0',
               '-c:v', 'libx264', '-preset', 'fast', '-threads', '6', '-crf', '17',
               '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-t', '25.5',
               '-movflags', '+faststart', str(completed)]
        encoder = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        for i in range(count):
            ok, frame = cap.read()
            assert ok, i
            original = frame[y0:y1, x0:x1]
            frame[y0:y1, x0:x1] = np.clip(
                original * (1 - alpha) + plate * alpha, 0, 255).astype(np.uint8)
            encoder.stdin.write(frame.tobytes())
            if i % 150 == 0:
                print(f'Encoding stable {a.format} facade: {i}/{count}', flush=True)
        encoder.stdin.close()
        assert encoder.wait() == 0
        cap.release()
        info = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
            'stream=width,height,nb_frames,r_frame_rate,duration', '-of', 'json',
            str(completed)]))['streams'][0]
        assert (info['width'], info['height'], int(info['nb_frames'])) == (*size, count)
        partial = a.output.with_suffix('.complete')
        shutil.copyfile(completed, partial)
        partial.replace(a.output)
    report = {'source_sha256': source_sha, 'format': a.format,
              'output_sha256': hashlib.sha256(a.output.read_bytes()).hexdigest(),
              'video': info, 'reference_frame': 0, 'outline': outline,
              'outline_scale': factor, 'box': box,
              'audio': 'existing quieter AAC bitstream copied unchanged',
              'camera': 'rigid building plate; unchanged fixed crop and playback speed',
              'outside_building': 'original film retained'}
    (a.work / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
