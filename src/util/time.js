/** Parse "30s", "10m", "2h", "1d", "1h30m" or a bare number of seconds. Returns seconds or null. */
function parseDuration(input) {
  if (input == null) return null;
  const str = String(input).trim().toLowerCase();
  if (/^\d+$/.test(str)) return Number(str);
  const re = /(\d+)\s*(d|h|m|s)/g;
  const mult = { d: 86400, h: 3600, m: 60, s: 1 };
  let total = 0;
  let matched = '';
  for (const m of str.matchAll(re)) {
    total += Number(m[1]) * mult[m[2]];
    matched += m[0];
  }
  return matched.replace(/\s/g, '') === str.replace(/\s/g, '') && matched ? total : null;
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (seconds === 0) return 'no cooldown';
  const parts = [];
  for (const [unit, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]) {
    const n = Math.floor(seconds / size);
    if (n) { parts.push(`${n}${unit}`); seconds -= n * size; }
  }
  return parts.join(' ');
}

module.exports = { parseDuration, formatDuration };
