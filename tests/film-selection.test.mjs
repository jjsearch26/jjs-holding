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

test('daytime selects the approved mounted signs at desktop and portrait 4K sizes', () => {
  const day = new Date(2026, 9, 22, 12);
  const desktop = schedule.select(day, false);
  const mobile = schedule.select(day, true);
  assert.deepEqual([films[desktop.key].width, films[desktop.key].height], [3840, 2160]);
  assert.deepEqual([films[mobile.key].width, films[mobile.key].height], [2160, 3840]);
  assert.equal(films[desktop.key].sha256, '0de7240558ea89f498482c9a19630672a0290ae709c45694fe06abf7a5979330');
  assert.equal(films[mobile.key].sha256, 'e86ac3665cb6951ec1fedf63776bdf1ba8bba0e457c514a7b9dd5bcc5848fbbb');
});

test('clock selection retains the 7am and 7pm boundaries', () => {
  for (const [hour, period] of [[6,'nighttime'], [7,'daytime'], [18,'daytime'], [19,'nighttime']]) {
    assert.equal(schedule.select(new Date(2026, 9, 22, hour), false).period, period);
  }
});
