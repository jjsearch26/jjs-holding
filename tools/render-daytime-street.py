from pathlib import Path
import cv2
import numpy as np
import math
import subprocess
import sys
import json
import shutil
import os

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'work'
OUT=ROOT/'output'
MASTER=ROOT/'generated_images/exec-4aadc0a9-0b7f-4319-97f2-b99686e47ec9.png'
DETAIL=ROOT/'generated_images/exec-f5f598c3-281b-47f6-8b0d-25baa0ed563e.png'
SCALE=4
TOP=200
FPS=30
CONFIG={
 'desktop':{'source':'IMG_3797.mp4','audio':'IMG_3797.mp4','tracking':'desktop','size':(1920,1080),'wide':(0.,0.,1672.),'close':(744.,0.,448.),'hold':5.0,'source_offset':315},
 'mobile':{'source':'IMG_3797.mp4','audio':'IMG_3796.mp4','tracking':'desktop','size':(1080,1920),'wide':(712.5,0.,529.),'close':(802.,-150.,350.),'hold':3.0,'source_offset':480},
}
cv2.setNumThreads(3)

def smooth(x):
 x=float(np.clip(x,0,1));return x*x*x*(10+x*(-15+6*x))

def progress(label,t):
 u=float(np.clip((t-CONFIG[label]['hold'])/29.0,0,1));r=.075
 if u<r:v=u*u/(2*r)
 elif u>1-r:v=(1-r)-(1-u)*(1-u)/(2*r)
 else:v=u-r/2
 return v/(1-r)

def build_atlas():
 base=cv2.imread(str(MASTER));detail=cv2.imread(str(DETAIL))
 h,w=base.shape[:2]
 # Extend only clear sky for the portrait camera's upward movement.
 ys,xs=np.mgrid[0:180:3,300:700:3]
 ys2,xs2=np.mgrid[0:180:3,1160:1380:3]
 ys=np.r_[ys.ravel(),ys2.ravel()];xs=np.r_[xs.ravel(),xs2.ravel()]
 x=xs/w;y=ys/h
 basis=np.column_stack([np.ones(len(x)),x,y,x*x,x*y,y*y])
 coefficients=np.linalg.lstsq(basis,base[ys,xs].astype(float),rcond=None)[0]
 yy,xx=np.mgrid[0:TOP*SCALE,0:w*SCALE].astype(np.float32)
 xx/=w*SCALE;yy=(yy/SCALE-TOP)/h
 sky=coefficients[0]+xx[:,:,None]*coefficients[1]+yy[:,:,None]*coefficients[2]+xx[:,:,None]**2*coefficients[3]+(xx*yy)[:,:,None]*coefficients[4]+yy[:,:,None]**2*coefficients[5]
 atlas=np.zeros(((h+TOP)*SCALE,w*SCALE,3),np.uint8)
 atlas[:TOP*SCALE]=np.clip(sky,0,255).astype(np.uint8)
 atlas[TOP*SCALE:]=cv2.resize(base,(w*SCALE,h*SCALE),interpolation=cv2.INTER_LANCZOS4)
 Hdetail=np.load(WORK/'day-detail-to-master.npy')
 # Register and colour-match the detailed close view before integrating it.
 reference=base[:252,744:1192]
 T=np.array([[1.,0,-744],[0,1,0],[0,0,1]])@Hdetail
 low=cv2.warpPerspective(detail,T,(448,252))
 offset=np.median(reference[:18].astype(float)-low[:18].astype(float),axis=(0,1))
 detail=np.clip(detail.astype(float)+offset,0,255).astype(np.uint8)
 dh,dw=detail.shape[:2]
 py,px=np.mgrid[0:dh,0:dw].astype(np.float32)
 alpha=np.minimum.reduce([np.ones((dh,dw),np.float32),px/85,(dw-1-px)/85,py/12,(dh-1-py)/105])
 alpha=np.clip(alpha,0,1)
 # Only a small upper facade region needs the extra detail.
 x0,y0,x1,y1=700*SCALE,(TOP-2)*SCALE,1230*SCALE,(TOP+300)*SCALE
 placement=np.array([[SCALE,0,-x0],[0,SCALE,TOP*SCALE-y0],[0,0,1]],float)@Hdetail
 size=(x1-x0,y1-y0)
 rgb=cv2.warpPerspective(detail.astype(np.float32)*alpha[:,:,None],placement,size,flags=cv2.INTER_CUBIC)
 a=cv2.warpPerspective(alpha,placement,size,flags=cv2.INTER_CUBIC)
 a=np.clip(a,0,1)
 atlas[y0:y1,x0:x1]=np.clip(atlas[y0:y1,x0:x1].astype(float)*(1-a[:,:,None])+rgb,0,255).astype(np.uint8)
 # Match the added portrait headroom to the finished image boundary exactly,
 # including the detailed shot's sky colour, so no horizontal seam appears.
 boundary=np.mean(atlas[TOP*SCALE:TOP*SCALE+4].astype(np.float32),axis=0)
 boundary=cv2.GaussianBlur(boundary[None,:,:],(0,0),4)[0]
 distance=np.linspace(1,0,TOP*SCALE,dtype=np.float32)[:,None,None]
 atlas[:TOP*SCALE]=np.clip(boundary[None,:,:]+distance*np.array([0,-1.5,-3],np.float32),0,255).astype(np.uint8)
 # Smooth the clear-sky continuation over a broad strip; all lettering is
 # below this area, so its detail remains untouched.
 ya,yb=(TOP-30)*SCALE,(TOP+15)*SCALE
 xa,xb=300*SCALE,1350*SCALE
 a0=atlas[ya,xa:xb].astype(np.float32)
 a1=atlas[yb,xa:xb].astype(np.float32)
 t=np.linspace(0,1,yb-ya,dtype=np.float32)[:,None,None]
 t=t*t*(3-2*t)
 atlas[ya:yb,xa:xb]=np.clip(a0[None,:,:]*(1-t)+a1[None,:,:]*t,0,255).astype(np.uint8)
 np.save(WORK/'daytime-scene-atlas.npy',atlas)
 meta={'width':w,'height':h,'atlas_scale':SCALE,'top_extension':TOP,'detail_registration_colour_offset':offset.tolist()}
 (WORK/'daytime-atlas.json').write_text(json.dumps(meta,indent=2))
 assets=WORK/'revision-assets'
 shutil.copy2(MASTER,assets/'daytime-street-master.png')
 shutil.copy2(DETAIL,assets/'daytime-sign-detail.png')
 print(json.dumps(meta),flush=True)

def camera(label,p):
 cfg=CONFIG[label];W,H=cfg['size'];ratio=H/W
 ax,ay,aw=cfg['wide'];bx,by,bw=cfg['close']
 w=math.exp((1-p)*math.log(aw)+p*math.log(bw));h=w*ratio
 q=math.sin(math.pi*p/2)
 cx=(ax+aw/2)*(1-q)+(bx+bw/2)*q
 if label=='desktop':top=0.
 else:
  cy=(ay+aw*ratio/2)*(1-q)+(by+bw*ratio/2)*q
  top=cy-h/2
  # Keep the approved sign's horizontal centre fixed from the first frame.
  # The vertical approach still starts at street level and rises to the roof.
  cx=bx+bw/2
 left=cx-w/2
 s=W/w
 matrix=np.array([[s,0,-left*s],[0,s,-top*s],[0,0,1]],float)
 return matrix,(left,top,w,h)

def setup(label):
 cfg=CONFIG[label]
 atlas=np.load(WORK/'daytime-scene-atlas.npy',mmap_mode='r')
 cap=cv2.VideoCapture(str(ROOT/'upload'/cfg['source']))
 ok,ref=cap.read();assert ok
 cap.release()
 sh,sw=ref.shape[:2]
 yy,xx=np.mgrid[0:sh,0:sw]
 edge=np.minimum.reduce([xx/4.,(sw-1-xx)/4.,yy/4.,(sh-1-yy)/4.,np.ones((sh,sw))])
 edge=np.clip(edge,0,1).astype(np.float32)
 tracking=cfg['tracking']
 return cfg,atlas,ref,edge,np.load(WORK/f'{tracking}-camera.npy'),np.load(WORK/f'{tracking}-live-to-day-master.npy')

def frame_at(label,cfg,atlas,frame,edge,cam_transform,scene_transform,p):
 W,H=cfg['size']
 M,rect=camera(label,p)
 atlas_to_world=np.array([[1/SCALE,0,0],[0,1/SCALE,-TOP],[0,0,1]],float)
 static=cv2.warpPerspective(atlas,M@atlas_to_world,(W,H),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
 left,top,w,h=rect
 blend=np.clip((top+np.arange(H)*(h/H)-700)/80,0,1).astype(np.float32)
 if blend.max()<=0:return static,rect,False
 transform=M@scene_transform@np.linalg.inv(cam_transform)
 coverage=cv2.warpPerspective(edge,transform,(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 actual=cv2.warpPerspective(frame.astype(np.float32)*edge[:,:,None],transform,(W,H),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)
 alpha=np.clip(coverage*blend[:,None],0,1)
 # Fade only the boundary above the street; road users are opaque live
 # footage below it. Both supplied clips retain their actual motion.
 result=static.astype(np.float32)*(1-alpha[:,:,None])+actual*blend[:,None,None]
 return np.clip(result,0,255).astype(np.uint8),rect,True

def main(label,preview=False):
 cfg,atlas,ref,edge,transforms,scene_transform=setup(label)
 W,H=cfg['size']
 DURATION=int(cfg['hold']+29+4)
 if preview:
  for name,p in [('street',0),('middle',.5),('sign',1)]:
   image,rect,live=frame_at(label,cfg,atlas,ref,edge,transforms[0],scene_transform,p)
   cv2.imwrite(str(WORK/'frames'/f'{label}-day-live-{name}.png'),image)
   print(json.dumps({'mode':label,'view':name,'crop':list(map(float,rect)),'live_street_visible':live}),flush=True)
  print('Street at source repeat:',camera(label,progress(label,(len(transforms)-cfg['source_offset'])/FPS))[1][1::2],flush=True)
  return
 path=ROOT/'jjs-holding'/f'daytime-{label}-v2.mp4'
 encode_path=WORK/f'{label}-render-{os.getpid()}.mp4'
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y',
 '-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
 '-stream_loop','-1','-ss',str(cfg['source_offset']/FPS if label=='desktop' else 0),'-i',str(ROOT/'upload'/cfg['audio']),
 '-map','0:v:0','-map','1:a:0','-t',str(DURATION),
 '-c:v','libx264','-preset','slow','-crf','18','-maxrate','4900k','-bufsize','9800k','-pix_fmt','yuv420p','-threads','4',
 '-vf',f'fade=t=in:d=0.35,fade=t=out:st={DURATION-.5}:d=0.5',
 '-c:a','aac','-b:a','160k','-af',f'volume=0.6,afade=t=in:d=0.35,afade=t=out:st={DURATION-.5}:d=0.5',
 '-movflags','+faststart',str(encode_path)]
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 cap=cv2.VideoCapture(str(ROOT/'upload'/cfg['source']))
 samples=[]
 for i in range(DURATION*FPS):
  index=(i+cfg['source_offset'])%len(transforms)
  if i==0 or index==0:cap.set(cv2.CAP_PROP_POS_FRAMES,index)
  ok,frame=cap.read()
  if not ok:raise RuntimeError(f'Cannot read moving source frame {index}')
  p=progress(label,i/FPS)
  output,rect,live=frame_at(label,cfg,atlas,frame,edge,transforms[index],scene_transform,p)
  proc.stdin.write(output.tobytes())
  if i in [30,60,90,120,150,210,240,270,360,600,900]:
   cv2.imwrite(str(WORK/'frames'/f'{label}-day-v2-frame-{i}.png'),output)
   samples.append({'frame':i,'source_frame':index,'street_visible':live,'crop':list(map(float,rect))})
  if i%240==0:print(f'{label}: {i}/{FPS*DURATION} frames',flush=True)
 proc.stdin.close()
 if proc.wait()!=0:raise RuntimeError('Encoding failed')
 encode_path.replace(path)
 cap.release()
 (WORK/f'{label}-day-v2-motion.json').write_text(json.dumps(samples,indent=2))
 print(str(path),flush=True)

if __name__=='__main__':
 if sys.argv[1]=='atlas':build_atlas()
 else:main(sys.argv[1],len(sys.argv)>2 and sys.argv[2]=='preview')
