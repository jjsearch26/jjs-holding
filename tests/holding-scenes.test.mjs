import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const scheduleSource = await readFile(new URL('../holding-schedule.js', import.meta.url), 'utf8');
const playerSource = await readFile(new URL('../holding.js', import.meta.url), 'utf8');

class Element extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.style = {};
    this.src = '';
    this.paused = true;
    this.readyState = 4;
    this.hidden = false;
    const classes = new Set();
    this.classList = {add: c => classes.add(c), remove: c => classes.delete(c)};
  }
  setAttribute(name, value) { this[name] = value; }
  getAttribute(name) { return this[name] || null; }
  removeAttribute(name) { this[name] = ''; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
}

async function player(hour = 12) {
  let currentHour = hour;
  let timerId = 0;
  const timers = new Map();
  const videos = [new Element(), new Element()];
  const elements = Object.fromEntries(
    ['film-poster', 'sound', 'play', 'status', 'film-ambience'].map(id => [id, new Element()]));
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: {dataset: {}},
    querySelectorAll: () => videos,
    getElementById: id => elements[id] || null
  });
  const portrait = Object.assign(new EventTarget(), {matches: false});
  const reduce = Object.assign(new EventTarget(), {matches: false});
  const loads = [];
  const window = Object.assign(new EventTarget(), {
    jjsKeepFilmLooping() {},
    jjsReleaseFilm(video) { video.pause(); video.src = ''; },
    async jjsLoadFilm(video, key) {
      loads.push(key);
      video.src = '/film/' + key;
      return true;
    }
  });
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 22, currentHour])); }
  }
  const context = vm.createContext({
    window, document, Date: Clock,
    Image: class { async decode() {} },
    matchMedia: query => query.includes('orientation') ? portrait : reduce,
    setTimeout: (callback, delay) => {
      const id = ++timerId; timers.set(id, {callback, delay}); return id;
    },
    clearTimeout: id => timers.delete(id),
    setInterval() {}
  });
  vm.runInContext(scheduleSource, context);
  vm.runInContext(playerSource, context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return {
    document, elements, videos, loads,
    async sound() { elements.sound.dispatchEvent(new Event('click')); await settle(); },
    async mobile() { portrait.matches = true; portrait.dispatchEvent(new Event('change')); await settle(); },
    async hour(value) {
      currentHour = value;
      document.dispatchEvent(new Event('visibilitychange'));
      await settle();
      for (const [id, timer] of [...timers]) {
        if (timer.delay <= 2000) { timers.delete(id); timer.callback(); }
      }
      await settle();
    }
  };
}

test('daytime is a fixed image with no video or audio downloaded initially', async () => {
  const p = await player();
  assert.equal(p.document.documentElement.dataset.media, 'image');
  assert.equal(p.elements['film-poster'].src, '/images/daytime-desktop-still-v1.jpg');
  assert.equal(p.elements['film-poster'].style.animation, 'none');
  assert.equal(p.elements['film-poster'].style.transform, 'none');
  assert.equal(p.elements['film-ambience'].src, '');
  assert.equal(p.loads.length, 0);
  assert.ok(p.videos.every(video => !video.src && video.paused));
  assert.equal(p.elements.play.hidden, true);
});

test('sound and orientation changes keep the daytime scene as a still', async () => {
  const p = await player();
  await p.sound();
  assert.equal(p.elements['film-ambience'].src, '/daytime-quiet-still-v1.m4a');
  assert.equal(p.elements['film-ambience'].paused, false);
  await p.mobile();
  assert.equal(p.elements['film-poster'].src, '/images/daytime-mobile-still-v1.jpg');
  assert.equal(p.elements['film-ambience'].paused, false);
  assert.equal(p.loads.length, 0);
  await p.sound();
  assert.equal(p.elements['film-ambience'].paused, true);
  assert.ok(p.videos.every(video => !video.src));
});

test('night uses the approved film, and switching back releases every video source', async () => {
  const p = await player();
  await p.hour(21);
  assert.equal(p.document.documentElement.dataset.media, 'video');
  assert.equal(p.loads[0], 'nighttime-desktop-mobile-loop-4k-v1');
  assert.ok(p.videos.some(video => video.src && !video.paused));
  await p.hour(12);
  assert.equal(p.document.documentElement.dataset.media, 'image');
  assert.ok(p.videos.every(video => !video.src && video.paused));
  assert.equal(p.elements.play.hidden, true);
});

test('a first visit at night still starts the approved video', async () => {
  const p = await player(21);
  assert.equal(p.document.documentElement.dataset.media, 'video');
  assert.equal(p.loads[0], 'nighttime-desktop-mobile-loop-4k-v1');
  assert.ok(p.videos.some(video => !video.paused));
});
