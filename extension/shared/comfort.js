// Shared, side-effect-free schedule and scrolling calculations.
// This file works both as a classic content script and as an ES module dependency.
(() => {
  const percent = (value, fallback = 100) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(Math.min(100, Math.max(0, value)))
      : fallback;
  function minutes(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }
  function cleanGrayscale(value) {
    const windows = [];
    for (const entry of Array.isArray(value?.windows) ? value.windows.slice(0, 12) : []) {
      if (!entry || minutes(entry.start) === null || minutes(entry.end) === null) continue;
      const days = [
        ...new Set(
          (Array.isArray(entry.days) ? entry.days : []).filter(
            (day) => Number.isInteger(day) && day >= 0 && day <= 6,
          ),
        ),
      ].sort();
      if (!days.length) continue;
      windows.push({ days, start: entry.start, end: entry.end, level: percent(entry.level) });
    }
    return {
      enabled: value?.enabled === true,
      level: percent(value?.level),
      scheduled: value?.scheduled === true,
      windows,
    };
  }
  function cleanSchedule(value) {
    const windows = [];
    for (const entry of Array.isArray(value?.windows) ? value.windows.slice(0, 12) : []) {
      if (!entry || minutes(entry.start) === null || minutes(entry.end) === null) continue;
      const days = [
        ...new Set(
          (Array.isArray(entry.days) ? entry.days : []).filter(
            (day) => Number.isInteger(day) && day >= 0 && day <= 6,
          ),
        ),
      ].sort();
      if (days.length) windows.push({ days, start: entry.start, end: entry.end });
    }
    return { scheduled: value?.scheduled === true, windows };
  }
  function windowActive(entry, date) {
    const start = minutes(entry.start),
      end = minutes(entry.end);
    if (
      start === null ||
      end === null ||
      !Array.isArray(entry.days) ||
      !Number.isFinite(date.getTime())
    )
      return false;
    const day = date.getDay(),
      time = date.getHours() * 60 + date.getMinutes();
    if (start === end) return entry.days.includes(day); // Explicitly all day on selected calendar days.
    if (start < end) return entry.days.includes(day) && time >= start && time < end;
    return (
      (entry.days.includes(day) && time >= start) ||
      (entry.days.includes((day + 6) % 7) && time < end)
    );
  }
  function grayscaleAt(value, date = new Date()) {
    const gray = cleanGrayscale(value);
    if (!gray.enabled) return 0;
    if (!gray.scheduled) return gray.level;
    return Math.max(
      0,
      ...gray.windows.filter((entry) => windowActive(entry, date)).map((entry) => entry.level),
    );
  }
  function settingAt(enabled, schedule, date = new Date()) {
    if (enabled !== true) return false;
    const clean = cleanSchedule(schedule);
    return !clean.scheduled || clean.windows.some((entry) => windowActive(entry, date));
  }
  function pageDistance(height, occlusion = 0) {
    const viewport = Math.max(1, height);
    // Sticky layouts often report several overlapping ancestors. Cap their effect so
    // a header can preserve context without shrinking a page jump to half a screen.
    const obstruction = Math.min(
      Math.max(0, Number(occlusion) || 0),
      Math.min(96, viewport * 0.12),
    );
    const overlap = Math.min(28, Math.max(12, viewport * 0.04));
    return Math.max(1, viewport - obstruction - overlap);
  }
  // Wheel events have no portable gesture ID. Group momentum until a quiet gap.
  function createWheelGate(gap = 320) {
    let last = -Infinity;
    let direction = 0;
    let amount = 0;
    let moved = false;
    return {
      take(delta, now, mode = 0) {
        const sign = Math.sign(delta);
        if (!sign || !Number.isFinite(now)) return false;
        if (now - last > gap || sign !== direction) {
          amount = 0;
          moved = false;
        }
        last = now;
        direction = sign;
        amount += Math.abs(delta) * (mode === 1 ? 16 : mode === 2 ? 800 : 1);
        if (moved || amount < 8) return false;
        moved = true;
        return true;
      },
      reset() {
        last = -Infinity;
        direction = 0;
        amount = 0;
        moved = false;
      },
    };
  }
  Object.defineProperty(globalThis, 'QuietBrowseComfort', {
    value: Object.freeze({
      percent,
      minutes,
      cleanGrayscale,
      cleanSchedule,
      windowActive,
      grayscaleAt,
      settingAt,
      pageDistance,
      createWheelGate,
    }),
    configurable: true,
  });
})();
