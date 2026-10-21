(()=>{
 const loads=new WeakMap();
 let catalogue;
 window.jjsReleaseFilm=function(video){
  const previous=loads.get(video);
  if(previous){loads.delete(video);previous.abort.abort();if(previous.url)URL.revokeObjectURL(previous.url);}
  video.pause();video.removeAttribute('src');video.load();
 };
 window.jjsLoadFilm=async function(video,key){
  const previous=loads.get(video);
  if(previous){previous.abort.abort();if(previous.url)URL.revokeObjectURL(previous.url);}
  const state={abort:new AbortController(),url:null};loads.set(video,state);
  video.pause();
  catalogue??=fetch('/films.json').then(r=>{if(!r.ok)throw Error('Film list unavailable');return r.json();});
  const films=await catalogue;
  const film=films[key];if(!film)throw Error('Film unavailable');
  try{
   const bytes=await Promise.all(film.parts.map(async path=>{
    const response=await fetch(path,{signal:state.abort.signal});
    if(!response.ok)throw Error('Film unavailable');
    return response.arrayBuffer();
   }));
   if(loads.get(video)!==state)return false;
   const blob=new Blob(bytes,{type:'video/mp4'});
   if(blob.size!==film.size)throw Error('Incomplete film');
   state.url=URL.createObjectURL(blob);video.src=state.url;video.load();
   return true;
  }catch(error){if(error.name==='AbortError')return false;throw error;}
 };
})();
