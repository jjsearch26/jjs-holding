import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../functions/film/[key].js',import.meta.url),'utf8');
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const contents=new TextEncoder().encode('ABCDEFGHIJKLMNO');
const film={parts:['/media/a.bin','/media/b.bin','/media/c.bin'],partSizes:[5,5,5],size:15,sha256:'test-film'};

function context({range,method='GET',rangedAssets=true,headers={},fail=false}={}) {
 const calls=[];
 return {calls,request:new Request('https://jonathanjamessearch.com/film/test',{method,headers:{...headers,...(range?{Range:range}:{})}}),params:{key:'test'},env:{ASSETS:{async fetch(request) {
  const path=new URL(request.url).pathname;
  if(path==='/films.json') return Response.json({test:film});
  calls.push(request);
  if(fail) return new Response(null,{status:404});
  const index=film.parts.indexOf(path),body=contents.slice(index*5,index*5+5);
  if(!rangedAssets) return new Response(body);
  const [,from,to]=/bytes=(\d+)-(\d+)/.exec(request.headers.get('Range'));
  return new Response(body.slice(Number(from),Number(to)+1),{status:206,headers:{'Content-Range':`bytes ${from}-${to}/5`}});
 }}}};
}

test('full playback streams every byte in order',async()=>{
 const response=await onRequest(context());
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Type'),'video/mp4');
 assert.equal(response.headers.get('Content-Length'),'15');
 assert.equal(await response.text(),'ABCDEFGHIJKLMNO');
});
test('cross-part ranges preserve exact byte positions',async()=>{
 const ctx=context({range:'bytes=3-11'}),response=await onRequest(ctx);
 assert.equal(response.status,206);
 assert.equal(response.headers.get('Content-Range'),'bytes 3-11/15');
 assert.equal(await response.text(),'DEFGHIJKL');
 assert.equal(ctx.calls.length,3);
});
test('handles asset servers that return the whole part',async()=>{
 const response=await onRequest(context({range:'bytes=4-7',rangedAssets:false}));
 assert.equal(await response.text(),'EFGH');
});
test('supports suffix, open-ended and clipped ranges',async()=>{
 for(const [range,expected] of [['bytes=-4','LMNO'],['bytes=12-','MNO'],['bytes=13-99','NO']]) {
  assert.equal(await (await onRequest(context({range}))).text(),expected);
 }
});
test('rejects unsatisfiable and multiple ranges',async()=>{
 for(const range of ['bytes=15-','bytes=8-2','bytes=-0','bytes=0-1,3-4','bytes=999999999999999999999-']) {
  const response=await onRequest(context({range}));
  assert.equal(response.status,416);
  assert.equal(response.headers.get('Content-Range'),'bytes */15');
 }
});
test('HEAD reads metadata without downloading video parts',async()=>{
 const ctx=context({method:'HEAD',range:'bytes=3-7'}),response=await onRequest(ctx);
 assert.equal(response.status,206);
 assert.equal(response.headers.get('Content-Length'),'5');
 assert.equal(await response.text(),'');
 assert.equal(ctx.calls.length,0);
});
test('supports cache validation and a changed If-Range validator',async()=>{
 assert.equal((await onRequest(context({headers:{'If-None-Match':'"test-film"'}}))).status,304);
 const response=await onRequest(context({range:'bytes=3-4',headers:{'If-Range':'"older-film"'}}));
 assert.equal(response.status,200);
 assert.equal(await response.text(),'ABCDEFGHIJKLMNO');
});
test('rejects unknown films and unsupported methods',async()=>{
 const ctx=context();ctx.params.key='__proto__';
 assert.equal((await onRequest(ctx)).status,404);
 assert.equal((await onRequest(context({method:'POST'}))).status,405);
});
test('unavailable segments fail instead of returning corrupt video',async()=>{
 const response=await onRequest(context({fail:true}));
 await assert.rejects(response.arrayBuffer(),/Film segment unavailable/);
});
