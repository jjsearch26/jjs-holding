import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../holding-schedule.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, {window, Date});
const schedule = window.JJSHoldingSchedule;

test('both night layouts select fixed images and optional shared ambience', () => {
  const night = new Date(2026, 9, 22, 22);
  const desktop = schedule.select(night, false);
  const mobile = schedule.select(night, true);
  assert.equal(desktop.type, 'image');
  assert.equal(mobile.type, 'image');
  assert.equal(desktop.poster, '/images/nighttime-city-branded-v4.png');
  assert.equal(mobile.poster, '/images/nighttime-city-branded-v4.png');
  assert.equal(mobile.format, 'mobile');
  assert.equal(desktop.format, 'desktop');
  assert.equal(desktop.audioSource, '/nighttime-still-ambience-v1.m4a');
  assert.equal(mobile.audioSource, desktop.audioSource);
});

test('daytime selects fixed images and the shared quieter audio', () => {
  const day = new Date(2026, 9, 22, 12);
  const desktop = schedule.select(day, false);
  const mobile = schedule.select(day, true);
  assert.equal(desktop.type, 'image');
  assert.equal(mobile.type, 'image');
  assert.equal(desktop.poster, '/images/daytime-desktop-clear-v3.jpg');
  assert.equal(mobile.poster, '/images/daytime-mobile-still-v1.jpg');
  assert.equal(desktop.audio, 'separate');
  assert.equal(desktop.audioSource, '/daytime-quiet-still-v1.m4a');
  assert.equal(desktop.audioSource, mobile.audioSource);
});

test('clock selection retains the 7am and 7pm boundaries', () => {
  for (const [hour, period] of [[6,'nighttime'], [7,'daytime'], [18,'daytime'], [19,'nighttime']]) {
    assert.equal(schedule.select(new Date(2026, 9, 22, hour), false).period, period);
  }
});
