import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSettings,
  cleanState,
  cleanGrayscale,
  cleanSchedule,
  grayscaleAt,
  settingAt,
} from '../extension/shared/settings.js';
const { windowActive, createWheelGate, pageDistance } = globalThis.QuietBrowseComfort;

// These tests cover pure settings, schedule, grayscale, and paging calculations.
// Date constructors use the test machine's local timezone, just like the extension.
const monday = (hour, minute = 0) => new Date(2026, 7, 24, hour, minute);
const config = (windows) => ({ enabled: true, scheduled: true, level: 37, windows });

test('old preferences migrate with paging and grayscale off and no shared mutable defaults', () => {
  const original = {
    version: 1,
    sites: { 'https://example.com': { enabled: true, settings: { motion: false } } },
  };
  const state = cleanState(original);
  assert.equal(state.version, 4);
  assert.equal(state.recommendedVersion, 0);
  assert.equal(state.sites['https://example.com'].settings.motion, false);
  assert.equal(state.sites['https://example.com'].settings.pageMode, false);
  assert.equal(state.sites['https://example.com'].settings.youtubePictureCover, false);
  assert.equal(state.sites['https://example.com'].settings.socialSuggestions, true);
  assert.equal(state.sites['https://example.com'].settings.grayscale.enabled, false);
  const firstSettings = cleanSettings();
  const secondSettings = cleanSettings();
  firstSettings.grayscale.windows.push({});
  firstSettings.socialSchedules.socialStories.windows.push({});
  assert.equal(secondSettings.grayscale.windows.length, 0);
  assert.equal(secondSettings.socialSchedules.socialStories.windows.length, 0);
  assert.equal(original.version, 1);
});
test('grayscale sanitizes strengths, flags, days, malformed times and unknown data', () => {
  const clean = cleanGrayscale({
    enabled: 'yes',
    scheduled: true,
    level: 105,
    token: 'secret',
    windows: [
      {
        days: [1, 1, 6, -1, 7, '2'],
        start: '22:00',
        end: '07:00',
        level: -5,
        history: ['private'],
      },
      { days: [2], start: '24:00', end: '07:00' },
      { days: [], start: '10:00', end: '11:00' },
      null,
    ],
  });
  assert.deepEqual(clean, {
    enabled: false,
    scheduled: true,
    level: 100,
    windows: [{ days: [1, 6], start: '22:00', end: '07:00', level: 0 }],
  });
  assert.equal(cleanGrayscale({ level: 44.8 }).level, 45);
  assert.equal(cleanGrayscale({ level: NaN }).level, 100);
  assert.equal(
    cleanGrayscale({ windows: Array(20).fill({ days: [1], start: '01:00', end: '02:00' }) }).windows
      .length,
    12,
  );
});
test('manual amount covers both endpoints; master off overrides a schedule', () => {
  assert.equal(grayscaleAt({ enabled: true, level: 0 }), 0);
  assert.equal(grayscaleAt({ enabled: true, level: 100 }), 100);
  assert.equal(
    grayscaleAt(
      {
        enabled: false,
        scheduled: true,
        windows: [{ days: [1], start: '00:00', end: '00:00', level: 100 }],
      },
      monday(12),
    ),
    0,
  );
});
test('same-day windows include the start, exclude the end, and are full color outside', () => {
  const value = config([{ days: [1], start: '09:00', end: '17:00', level: 60 }]);
  assert.equal(grayscaleAt(value, monday(8, 59)), 0);
  assert.equal(grayscaleAt(value, monday(9)), 60);
  assert.equal(grayscaleAt(value, monday(16, 59)), 60);
  assert.equal(grayscaleAt(value, monday(17)), 0);
  assert.equal(grayscaleAt(value, new Date(2026, 7, 25, 12)), 0);
});
test('overnight days refer to the starting evening, including Sunday-to-Monday', () => {
  const window = { days: [1], start: '21:00', end: '07:00', level: 90 };
  assert.equal(windowActive(window, monday(6)), false);
  assert.equal(windowActive(window, monday(21)), true);
  assert.equal(windowActive(window, new Date(2026, 7, 25, 6, 59)), true);
  assert.equal(windowActive(window, new Date(2026, 7, 25, 7)), false);
  assert.equal(windowActive({ ...window, days: [0] }, monday(6)), true);
});
test('equal endpoints mean selected calendar days, not a rolling 24 hours', () => {
  const value = config([{ days: [1], start: '12:00', end: '12:00', level: 80 }]);
  assert.equal(grayscaleAt(value, monday(0)), 80);
  assert.equal(grayscaleAt(value, monday(23, 59)), 80);
  assert.equal(grayscaleAt(value, new Date(2026, 7, 25, 0)), 0);
});
test('overlaps use the highest strength and empty schedules do nothing', () => {
  const earlierWindow = { days: [1], start: '10:00', end: '14:00', level: 50 };
  const laterWindow = { days: [1], start: '12:00', end: '16:00', level: 100 };
  assert.equal(grayscaleAt(config([earlierWindow, laterWindow]), monday(12)), 100);
  assert.equal(grayscaleAt(config([laterWindow, earlierWindow]), monday(12)), 100);
  assert.equal(grayscaleAt(config([earlierWindow, laterWindow]), monday(11)), 50);
  assert.equal(grayscaleAt(config([]), monday(12)), 0);
  assert.equal(grayscaleAt(config([earlierWindow]), new Date(NaN)), 0);
});
test('social schedules use the same local-time and overnight rules', () => {
  const schedule = cleanSchedule({
    scheduled: true,
    windows: [{ days: [1], start: '21:00', end: '07:00', ignored: 'private' }],
  });
  assert.deepEqual(schedule, {
    scheduled: true,
    windows: [{ days: [1], start: '21:00', end: '07:00' }],
  });
  assert.equal(settingAt(true, schedule, monday(20, 59)), false);
  assert.equal(settingAt(true, schedule, monday(21)), true);
  assert.equal(settingAt(true, schedule, new Date(2026, 7, 25, 6, 59)), true);
  assert.equal(settingAt(true, schedule, new Date(2026, 7, 25, 7)), false);
  assert.equal(settingAt(false, { scheduled: false }), false);
  assert.equal(settingAt(true, { scheduled: false }), true);
});
test('page distances leave overlap and account for obscuring headers', () => {
  assert.equal(pageDistance(800), 772);
  assert.equal(pageDistance(800, 80), 692);
  assert.equal(pageDistance(800, 500), 676);
  assert.equal(pageDistance(100), 88);
  assert.equal(pageDistance(0), 1);
});
test('a wheel gesture moves once through momentum, then accepts a new gesture or reverse', () => {
  const gate = createWheelGate();
  assert.equal(gate.take(3, 0), false);
  assert.equal(gate.take(5, 20), true);
  assert.equal(gate.take(40, 40), false);
  assert.equal(gate.take(1, 80), false);
  assert.equal(gate.take(10, 400), false);
  assert.equal(gate.take(10, 721), true);
  assert.equal(gate.take(-10, 730), true);
  assert.equal(gate.take(-80, 750), false);
  gate.reset();
  assert.equal(gate.take(1, 460, 1), true);
  gate.reset();
  assert.equal(gate.take(1, 500, 2), true);
});
