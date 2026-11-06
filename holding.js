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

(() => {
 'use strict';
 const privacyUrl='/privacy.html';

 const style=document.createElement('style');
 style.textContent=`
  .jjs-privacy-access{
   position:fixed;
   left:50%;
   bottom:max(20px,env(safe-area-inset-bottom));
   transform:translateX(-50%);
   z-index:7;
   color:#f7f5ef;
   font:10px/1.3 Arial,Helvetica,sans-serif;
   letter-spacing:.08em;
   text-transform:uppercase;
   text-decoration:none;
   white-space:nowrap;
   padding-bottom:4px;
   border-bottom:1px solid rgba(210,181,116,.9);
   text-shadow:0 1px 8px rgba(0,0,0,.9);
  }
  .jjs-privacy-access:hover{color:#f1ddb0}
  .jjs-privacy-access:focus-visible{outline:2px solid #d2b574;outline-offset:5px}
  .jjs-inquiry-note a{
   color:#18344e;
   text-decoration:underline;
   text-underline-offset:3px;
  }
  @media(max-width:700px){
   .jjs-privacy-access{
    bottom:max(72px,calc(env(safe-area-inset-bottom) + 60px));
    font-size:9px;
    letter-spacing:.06em;
   }
  }
  @media(orientation:landscape) and (max-height:520px){
   .jjs-privacy-access{bottom:max(66px,calc(env(safe-area-inset-bottom) + 54px))}
  }
 `;
 document.head.append(style);

 if(!document.querySelector('.jjs-privacy-access')){
  const link=document.createElement('a');
  link.className='jjs-privacy-access';
  link.href=privacyUrl;
  link.textContent='Privacy & Data Promise';
  link.setAttribute('aria-label','Read the Jonathan James Search Privacy and Data Promise');
  document.body.append(link);
 }

 const formNote=document.querySelector('.jjs-inquiry-note');
 if(formNote){
  formNote.innerHTML='By submitting this form, you acknowledge our <a href="'+privacyUrl+'" target="_blank" rel="noopener">Privacy &amp; Data Promise</a>. Your inquiry will be treated in confidence.';
 }
})();
