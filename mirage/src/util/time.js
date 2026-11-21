/** Parse "30s", "10m", "2h", "1d", "1h30m" or a bare number of seconds. Returns seconds or null. */
function parseDuration(input) {
  if (input == null) return null;
  const str = String(input).trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(str)) return Number(str);
  if (!/^(\d+[dhms])+$/.test(str)) return null;
  const mult = { d: 86400, h: 3600, m: 60, s: 1 };
  let total = 0;
  for (const m of str.matchAll(/(\d+)([dhms])/g)) total += Number(m[1]) * mult[m[2]];
  return total;
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (!seconds) return '0s';
  const parts = [];
  for (const [unit, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]) {
    const n = Math.floor(seconds / size);
    if (n) { parts.push(`${n}${unit}`); seconds -= n * size; }
  }
  return parts.join(' ');
}

module.exports = { parseDuration, formatDuration };
