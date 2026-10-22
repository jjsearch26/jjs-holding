let catalogue;

function selectRange(header, size) {
  if (!header) return {start:0, end:size-1, partial:false};
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size-suffix); end = size-1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size-1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return null;
    end = Math.min(end, size-1);
  }
  return {start, end, partial:true};
}

async function copyPart(response, writable, skip, length, completeBody) {
  if (!response.body) throw new Error('Film segment unavailable');
  if (completeBody) {
    // Keep complete asset bodies on the runtime's native stream path.
    await response.body.pipeTo(writable, {preventClose:true});
    return;
  }
  const writer = writable.getWriter();
  const reader = response.body.getReader();
  try {
    while (length > 0) {
      const {value, done} = await reader.read();
      if (done) throw new Error('Incomplete film segment');
      if (skip >= value.byteLength) { skip -= value.byteLength; continue; }
      const chunk = value.subarray(skip, Math.min(value.byteLength, skip+length));
      skip = 0; length -= chunk.byteLength;
      await writer.write(chunk);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    writer.releaseLock();
  }
}

export async function onRequest({request, env, params}) {
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  try {
    catalogue ??= env.ASSETS.fetch(new Request(new URL('/films.json',request.url))).then(async response => {
      if (!response.ok) throw new Error('Film catalogue unavailable');
      return response.json();
    }).catch(error => { catalogue=null; throw error; });
    const films=await catalogue, key=params.key;
    if (typeof key !== 'string' || !Object.hasOwn(films,key)) return new Response(null,{status:404});
    const film=films[key], etag='"'+film.sha256+'"';
    const headers=new Headers({'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400, immutable','X-Content-Type-Options':'nosniff','ETag':etag});
    if (request.headers.get('If-None-Match')?.split(',').some(value => value.trim()===etag || value.trim()==='*')) return new Response(null,{status:304,headers});
    const ifRange=request.headers.get('If-Range');
    const range=selectRange(ifRange && ifRange!==etag ? null : request.headers.get('Range'),film.size);
    if (!range) { headers.set('Content-Range','bytes */'+film.size); return new Response(null,{status:416,headers}); }
    const length=range.end-range.start+1, status=range.partial ? 206 : 200;
    headers.set('Content-Length',String(length));
    if (range.partial) headers.set('Content-Range',`bytes ${range.start}-${range.end}/${film.size}`);
    if (request.method==='HEAD') return new Response(null,{status,headers});
    const stream=typeof FixedLengthStream==='function' ? new FixedLengthStream(length) : new TransformStream();
    const abort=new AbortController();
    const pump=async () => {
      try {
        let offset=0;
        for (let index=0; index<film.parts.length; index++) {
          const partSize=film.partSizes?.[index] ?? Math.min(8388608,film.size-offset);
          const first=Math.max(range.start,offset), last=Math.min(range.end,offset+partSize-1);
          if (first<=last) {
            const start=first-offset, end=last-offset;
            const response=await env.ASSETS.fetch(new Request(new URL(film.parts[index],request.url),{headers:{Range:`bytes=${start}-${end}`},signal:abort.signal}));
            if (response.status!==200 && response.status!==206) throw new Error('Film segment unavailable');
            if (response.status===206 && response.headers.get('Content-Range')!==`bytes ${start}-${end}/${partSize}`) throw new Error('Invalid film segment range');
            await copyPart(response,stream.writable,response.status===206 ? 0 : start,last-first+1,response.status===206 || (start===0 && end===partSize-1));
          }
          offset+=partSize;
          if (offset>range.end) break;
        }
        const writer=stream.writable.getWriter();
        try { await writer.close(); } finally { writer.releaseLock(); }
      } catch (error) { abort.abort(); await stream.writable.abort(error).catch(() => {}); }
    };
    void pump();
    return new Response(stream.readable,{status,headers});
  } catch { return new Response('Film unavailable',{status:503,headers:{'Cache-Control':'no-store'}}); }
}
