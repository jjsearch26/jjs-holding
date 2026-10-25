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
  assert.equal(p.elements['film-poster'].src, '/images/daytime-desktop-clear-v3.jpg');
  assert.equal(p.elements['film-poster'].style.objectPosition, '50% 12%');
  assert.equal(p.elements['film-ambience'].src, '');
  assert.equal(p.loads.length, 0);
  assert.ok(p.videos.every(video => !video.src && video.paused));
});

test('orientation changes load the approved mobile still without audio', async () => {
  const p = await player();
  assert.equal(p.elements['film-ambience'].src, '');
  assert.equal(p.elements['film-ambience'].paused, true);
  await p.mobile();
  assert.equal(p.elements['film-poster'].src, '/images/daytime-mobile-still-v1.jpg');
  assert.equal(p.elements['film-ambience'].paused, true);
  assert.equal(p.loads.length, 0);
  assert.equal(p.elements['film-ambience'].paused, true);
  assert.ok(p.videos.every(video => !video.src));
});

test('clock changes switch between approved stills without audio', async () => {
  const p = await player();
  await p.hour(21);
  assert.equal(p.document.documentElement.dataset.media, 'image');
  assert.equal(p.elements['film-poster'].src, '/images/nighttime-city-branded-v4.png');
  assert.equal(p.elements['film-poster'].dataset.scene, 'nighttime-desktop');
  assert.equal(p.elements['film-ambience'].src, '');
  await p.mobile();
  assert.equal(p.elements['film-poster'].dataset.scene, 'nighttime-mobile');
  await p.hour(12);
  assert.equal(p.elements['film-poster'].src, '/images/daytime-mobile-still-v1.jpg');
  assert.equal(p.elements['film-ambience'].src, '');
  assert.equal(p.loads.length, 0);
});

test('a first visit at night loads a still without downloading audio or video', async () => {
  const p = await player(21);
  assert.equal(p.document.documentElement.dataset.media, 'image');
  assert.equal(p.elements['film-poster'].src, '/images/nighttime-city-branded-v4.png');
  assert.equal(p.elements['film-ambience'].src, '');
  assert.equal(p.loads.length, 0);
  assert.ok(p.videos.every(video => !video.src && video.paused));
});

test('current home and fixed routes contain no video or video loading scripts', async () => {
  for (const route of ['', 'daytime-desktop/', 'daytime-mobile/', 'nighttime-desktop/', 'nighttime-mobile/']) {
    const html = await readFile(new URL('../' + route + 'index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(html, /<video\b/i, route);
    assert.doesNotMatch(html, /<script[^>]+(?:film-loader|approved-film-source|review-media|night-mobile-crop)\.js/i, route);
    assert.doesNotMatch(html, /id="sound"|<audio\b/i, route);
    assert.match(html, /Launching <span>January 2027<\/span>/, route);
  }
});
