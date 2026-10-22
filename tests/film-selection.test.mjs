import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../holding-schedule.js', import.meta.url), 'utf8');
const films = JSON.parse(await readFile(new URL('../films.json', import.meta.url), 'utf8'));
const window = {};
vm.runInNewContext(source, {window, Date});
const schedule = window.JJSHoldingSchedule;

test('night desktop preserves the approved mobile film, loop speed and audio', () => {
  const night = new Date(2026, 9, 22, 22);
  const desktop = schedule.select(night, false);
  const mobile = schedule.select(night, true);
  assert.equal(films[desktop.key].sha256, films[mobile.key].sha256);
  assert.deepEqual(films[desktop.key].parts, films[mobile.key].parts);
  assert.equal(desktop.speed, 1);
  assert.equal(mobile.speed, 1);
  assert.equal(desktop.audio, 'embedded');
  assert.equal(desktop.position, mobile.position);
});

test('daytime selects fixed images and the shared quieter audio', () => {
  const day = new Date(2026, 9, 22, 12);
  const desktop = schedule.select(day, false);
  const mobile = schedule.select(day, true);
  assert.equal(desktop.type, 'image');
  assert.equal(mobile.type, 'image');
  assert.equal(desktop.poster, '/images/daytime-desktop-still-v1.jpg');
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
