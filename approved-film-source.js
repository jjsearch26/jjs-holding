(() => {
  'use strict';
  const video=document.getElementById('film');
  const progress=document.getElementById('review-load-status');
  video.addEventListener('loadeddata',()=>{progress.hidden=true;},{once:true});
  const catalogue=fetch('/films.json?v=daytime-natural-street-softer-20261022',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Film unavailable');return r.json();});
  window.jjsApprovedFilm=async path=>{
    const format=document.documentElement.dataset.format==='mobile'?'mobile':'desktop';
    const file=path.split('/').pop();
    const updated={'qa-day-desktop.mp4':'daytime-desktop-softer-4k-v1','qa-day-mobile.mp4':'daytime-mobile-natural-street-softer-4k-v1','qa-night-desktop.mp4':'nighttime-desktop-mobile-loop-4k-v1'};
    const key=updated[file] || (file==='qa-day.mp4'?'daytime-'+format+'-4k-v1':file==='qa-night-desktop.mp4'?'nighttime-desktop-4k-v1':'nighttime-mobile-4k-v1');
    const item=(await catalogue)[key];
    if(!item)throw new Error('Film unavailable');
    return '/film/'+encodeURIComponent(key)+'?v='+item.sha256.slice(0,12);
  };
})();
