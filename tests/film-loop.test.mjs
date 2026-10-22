import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../film-loader.js', import.meta.url), 'utf8');

function player() {
  let now = 0, id = 0, requested = true, active = true, resumes = 0;
  const timers = new Map();
  const document = {hidden:false};
  const window = {};
  const video = Object.assign(new EventTarget(), {
    currentSrc:'/film/nighttime-mobile-4k-v1', currentTime:10, duration:30,
    paused:false, ended:false, error:null, loop:false, muted:false, playbackRate:0.5
  });
  const addTimer = (callback, delay, repeat = 0) => {
    const key = ++id;
    timers.set(key, {callback, at:now + delay, repeat});
    return key;
  };
  vm.runInNewContext(source, {
    window, document, performance:{now:() => now},
    setTimeout:(callback, delay) => addTimer(callback, delay),
    clearTimeout:key => timers.delete(key),
    setInterval:(callback, delay) => addTimer(callback, delay, delay)
  });
  window.jjsKeepFilmLooping(video, {
    shouldPlay:() => requested && active,
    resume:() => { resumes++; video.paused = false; video.ended = false; }
  });
  return {
    video, document,
    get resumes() { return resumes; },
    request(value) { requested = value; },
    activate(value) { active = value; },
    emit(event) { video.dispatchEvent(new Event(event)); },
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [key, timer] = next;
        now = timer.at;
        if (timer.repeat) timer.at += timer.repeat;
        else timers.delete(key);
        timer.callback();
      }
      now = end;
    }
  };
}

test('restarts a completed mobile film when native looping fails', () => {
  const p = player();
  p.video.currentTime = 30; p.video.ended = true; p.video.paused = true;
  p.emit('ended'); p.advance(50);
  assert.equal(p.video.currentTime, 0);
  assert.equal(p.video.paused, false);
  assert.equal(p.resumes, 1);
  assert.equal(p.video.loop, true);
  assert.equal(p.video.muted, false);
  assert.equal(p.video.playbackRate, 0.5);
  assert.equal(p.video.currentSrc, '/film/nighttime-mobile-4k-v1');
});

test('recovers a paused final frame even without an ended event', () => {
  const p = player();
  p.video.currentTime = 29.99; p.video.paused = true;
  p.advance(1000);
  assert.equal(p.video.currentTime, 0);
  assert.equal(p.resumes, 1);
});

test('recovers a frozen final frame even when paused is false', () => {
  const p = player();
  p.video.currentTime = 29.99; p.emit('timeupdate');
  p.advance(1999);
  assert.equal(p.resumes, 0);
  p.advance(1);
  assert.equal(p.video.currentTime, 0);
  assert.equal(p.resumes, 1);
});

test('does not interrupt a native loop that is still progressing', () => {
  const p = player();
  for (const time of [29.8, 29.9, 0.1, 1.1]) {
    p.video.currentTime = time; p.emit('timeupdate'); p.advance(1000);
  }
  assert.equal(p.resumes, 0);
  assert.equal(p.video.currentTime, 1.1);
});

test('resumes an interrupted film at its existing position', () => {
  const p = player();
  p.video.paused = true; p.emit('pause'); p.advance(50);
  assert.equal(p.video.currentTime, 10);
  assert.equal(p.resumes, 1);
});

test('honors an intentional pause or reduced-motion opt-out', () => {
  const p = player();
  p.video.currentTime = 30; p.video.paused = true; p.emit('pause');
  p.request(false); p.advance(5000);
  assert.equal(p.resumes, 0);
  assert.equal(p.video.currentTime, 30);
});

test('does not play in the background and recovers when visible again', () => {
  const p = player();
  p.video.currentTime = 30; p.video.ended = true; p.video.paused = true;
  p.document.hidden = true; p.emit('ended'); p.advance(3000);
  assert.equal(p.resumes, 0);
  p.document.hidden = false; p.advance(1000);
  assert.equal(p.resumes, 1);
  assert.equal(p.video.currentTime, 0);
});

test('does not restart a film released during a day/night or orientation change', () => {
  const p = player();
  p.video.currentTime = 30; p.video.paused = true; p.emit('pause');
  p.activate(false); p.advance(5000);
  assert.equal(p.resumes, 0);
});

test('does not repeatedly attempt unavailable or unloaded films', () => {
  for (const state of [{error:new Error('Unavailable')}, {currentSrc:''}]) {
    const p = player();
    Object.assign(p.video, state, {currentTime:30, paused:true});
    p.emit('ended'); p.advance(5000);
    assert.equal(p.resumes, 0);
  }
});
