(() => {
 'use strict';
 const poster=document.getElementById('film-poster');
 const status=document.getElementById('status');
 const portrait=matchMedia('(max-width:900px) and (orientation:portrait)');
 let active='',pending='',revision=0,timer;
 async function refresh(){
  const now=new Date(),scene=window.JJSHoldingSchedule.select(now,portrait.matches);
  clearTimeout(timer);timer=setTimeout(refresh,Math.max(50,window.JJSHoldingSchedule.nextChange(now)-now+50));
  if(scene.key===active||scene.key===pending)return;
  const token=++revision;pending=scene.key;
  try{
   const image=new Image();image.src=scene.poster;await image.decode();
   if(token!==revision)return;
   poster.src=scene.poster;poster.dataset.scene=scene.period+'-'+scene.format;
   poster.style.objectPosition=scene.position;
   poster.alt='Jonathan James Search branding on the glass building';
   Object.assign(document.documentElement.dataset,{period:scene.period,format:scene.format,film:scene.key,media:'image'});
   active=scene.key;pending='';status.textContent='';
  }catch{if(token===revision){pending='';status.textContent='The launch image could not load. Please refresh to try again.';}}
 }
 portrait.addEventListener('change',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 for(const event of ['pageshow','focus','online'])window.addEventListener(event,refresh);
 setInterval(()=>{if(!document.hidden)refresh();},60000);
 refresh();
})();
