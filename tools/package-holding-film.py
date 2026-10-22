"""Package a reviewed high-resolution film without re-encoding its video."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--video',type=Path,required=True)
parser.add_argument('--audio',type=Path,required=True)
parser.add_argument('--key',required=True)
parser.add_argument('--work',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
args.work.mkdir(parents=True,exist_ok=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,duration,codec_name','-of','json',str(args.video)]))['streams'][0]
if probe['codec_name']!='h264':
    raise SystemExit('Review browser codec compatibility before packaging a non-H.264 master.')
if max(probe['width'],probe['height'])<3800:
    raise SystemExit('Expected the reviewed enhanced 4K master.')
output=args.work/(args.key+'.mp4')
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(args.video),'-i',str(args.audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','copy','-t',probe['duration'],'-movflags','+faststart',str(output)],check=True)
poster=root/(args.key+'.jpg')
# The daytime film has an approved opening fade; use its first clear frame.
poster_time='1' if args.key.startswith('daytime-') else '0'
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-ss',poster_time,'-i',str(output),'-frames:v','1','-q:v','2',str(poster)],check=True)
parts=[];sizes=[];sha=hashlib.sha256()
with output.open('rb') as film:
    index=0
    while chunk:=film.read(8*1024*1024):
        path=root/'media'/f'{args.key}-{index:02d}.bin'
        path.write_bytes(chunk)
        parts.append('/'+str(path.relative_to(root)))
        sizes.append(len(chunk));sha.update(chunk);index+=1
if len(parts)>45:
    raise SystemExit('Too many parts for one streaming request; review packaging before publishing.')
catalogue_path=root/'films.json'
catalogue=json.loads(catalogue_path.read_text())
catalogue[args.key]={'parts':parts,'partSizes':sizes,'size':sum(sizes),'sha256':sha.hexdigest(),'width':probe['width'],'height':probe['height'],'fps':probe['r_frame_rate'],'quality':'enhanced-4k'}
catalogue_path.write_text(json.dumps(catalogue,separators=(',',':'))+'\n')
print(json.dumps({'key':args.key,'output':str(output),'poster':str(poster),'size':sum(sizes),'parts':len(parts),'width':probe['width'],'height':probe['height'],'sha256':sha.hexdigest()}))
