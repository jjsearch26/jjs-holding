import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../night-mobile-crop.js', import.meta.url), 'utf8');
function player() {
  const video = Object.assign(new EventTarget(), {
    dataset: {scene:'nighttime-mobile'}, style: {width:'100%', height:'100%', transform:'', objectFit:'cover'},
    videoWidth:2160, videoHeight:3836, currentTime:0, paused:true,
    parentElement:{clientWidth:390,clientHeight:844}, hasAttribute:()=>false
  });
  const document = Object.assign(new EventTarget(), {hidden:false,querySelectorAll:()=>[video]});
  const window = {};
  vm.runInNewContext(source, {window,document,ResizeObserver:class {observe() {}},cancelAnimationFrame(){}});
  return {video,window};
}

test('a reused mobile video returns to its normal framing for desktop', () => {
  const {video,window} = player();
  assert.ok(parseFloat(video.style.width) > 390);
  assert.match(video.style.transform, /^translate3d/);
  video.dataset.scene = 'nighttime-desktop';
  window.jjsApplyNightMobileCrop(video);
  assert.equal(video.style.width, '100%');
  assert.equal(video.style.height, '100%');
  assert.equal(video.style.objectFit, 'cover');
  assert.equal(video.style.transform, '');
});

test('releasing the night video clears the crop before daytime stills', () => {
  const {video} = player();
  video.videoWidth = 0;
  video.dispatchEvent(new Event('emptied'));
  assert.equal(video.style.width, '100%');
  assert.equal(video.style.transform, '');
});
