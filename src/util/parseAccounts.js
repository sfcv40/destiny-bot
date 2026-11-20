/**
 * Parse account lines. Accepted separators between username and key: ":", "|", ";", ",", tab, or spaces.
 *   user1:KEY-123
 *   user2 | KEY-456
 * Blank lines and lines starting with # are ignored.
 */
function parseAccounts(text) {
  const entries = [];
  const invalid = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(.+?)\s*[:|;,\t]\s*(.+)$/) || line.match(/^(\S+)\s+(.+)$/);
    if (!m || !m[1].trim() || !m[2].trim()) { invalid.push(line); continue; }
    entries.push({ username: m[1].trim().slice(0, 200), key: m[2].trim().slice(0, 500) });
  }
  return { entries, invalid };
}

module.exports = { parseAccounts };
