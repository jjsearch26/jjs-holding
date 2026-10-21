(()=>{
 const fullBleed=document.documentElement.dataset.layout==='full-bleed';
 const switchLink=document.getElementById('layout-switch');
 const switchURL=new URL(location.href);
 switchURL.searchParams.set('layout',fullBleed?'framed':'full-bleed');
 if(switchLink){
  switchLink.href=switchURL.href;
  switchLink.textContent=fullBleed?'Framed view':'Full bleed';
  switchLink.setAttribute('aria-label',fullBleed?'Switch to framed view':'Switch to full bleed view');
 }
 document.title+=fullBleed?' | Full bleed':' | Framed';
 document.querySelectorAll('nav a').forEach(link=>{
  const target=new URL(link.href);target.searchParams.set('layout',fullBleed?'full-bleed':'framed');link.href=target.href;
 });
 const video=document.getElementById('film');
 const play=document.getElementById('play');
 const sound=document.getElementById('sound');
 const full=document.getElementById('fullscreen');
 const status=document.getElementById('status');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const speed=Number(video.dataset.speed)||1;
 let loaded=false;
 let requested=!reduce.matches;
 video.muted=true;video.defaultMuted=true;video.playsInline=true;
 video.defaultPlaybackRate=speed;video.playbackRate=speed;
 function sync(){
  play.textContent=loaded?(video.paused?'Play':'Pause'):'Loading…';
  play.dataset.playing=String(loaded&&!video.paused);
  sound.textContent=video.muted?'Sound on':'Sound off';
  sound.setAttribute('aria-pressed',String(!video.muted));
 }
 async function start(){
  if(document.hidden||!requested||!loaded)return;
  try{await video.play();}catch{status.textContent='Select Play to start the video.';}
  sync();
 }
 video.addEventListener('loadedmetadata',()=>{video.playbackRate=speed;start();});
 video.addEventListener('play',sync);video.addEventListener('pause',sync);
 video.addEventListener('volumechange',sync);
 video.addEventListener('error',()=>{status.textContent='The video could not load. Please refresh this page.';});
 play.addEventListener('click',()=>{requested=video.paused;if(requested)start();else video.pause();sync();});
 sound.addEventListener('click',()=>{video.muted=!video.muted;requested=true;start();sync();});
 full.addEventListener('click',async()=>{
  try{if(video.requestFullscreen)await video.requestFullscreen();else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();}catch{}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else start();});
 reduce.addEventListener('change',()=>{requested=!reduce.matches;if(requested)start();else video.pause();sync();});
 if(reduce.matches){video.autoplay=false;video.pause();}
 play.disabled=true;sound.disabled=true;
 window.jjsLoadFilm(video,video.dataset.film).then(ok=>{
  if(!ok)return;loaded=true;play.disabled=false;sound.disabled=false;
  video.defaultPlaybackRate=speed;video.playbackRate=speed;sync();start();
 }).catch(()=>{play.textContent='Video unavailable';status.textContent='The video could not load. Please refresh this page.';});
 sync();
})();
