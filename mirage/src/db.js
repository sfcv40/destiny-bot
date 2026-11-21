const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'mirage.db'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    guild_id            TEXT PRIMARY KEY,
    modlog_channel_id   TEXT,
    welcome_channel_id  TEXT,
    welcome_message     TEXT,
    autorole_id         TEXT
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT    NOT NULL,
    user_id     TEXT    NOT NULL,
    mod_id      TEXT    NOT NULL,
    reason      TEXT,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings (guild_id, user_id);

  -- Channels Mirage locked during a server lockdown, so ending it only unlocks those.
  CREATE TABLE IF NOT EXISTS lockdown_channels (
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    PRIMARY KEY (guild_id, channel_id)
  );
`);

const SETTING_COLUMNS = new Set(['modlog_channel_id', 'welcome_channel_id', 'welcome_message', 'autorole_id']);

function getSettings(guildId) {
  db.prepare('INSERT OR IGNORE INTO settings (guild_id) VALUES (?)').run(guildId);
  return db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(guildId);
}

function updateSettings(guildId, values) {
  getSettings(guildId);
  for (const [col, val] of Object.entries(values)) {
    if (!SETTING_COLUMNS.has(col)) throw new Error(`Unknown setting: ${col}`);
    db.prepare(`UPDATE settings SET ${col} = ? WHERE guild_id = ?`).run(val, guildId);
  }
  return getSettings(guildId);
}

const addWarning = (guildId, userId, modId, reason) =>
  db.prepare('INSERT INTO warnings (guild_id, user_id, mod_id, reason, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(guildId, userId, modId, reason, Date.now()).lastInsertRowid;
const listWarnings = (guildId, userId) =>
  db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC').all(guildId, userId);
const removeWarning = (guildId, id) =>
  db.prepare('DELETE FROM warnings WHERE guild_id = ? AND id = ?').run(guildId, id).changes;
const clearWarnings = (guildId, userId) =>
  db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId).changes;

const addLockdownChannel = (guildId, channelId) =>
  db.prepare('INSERT OR IGNORE INTO lockdown_channels (guild_id, channel_id) VALUES (?, ?)').run(guildId, channelId);
const getLockdownChannels = (guildId) =>
  db.prepare('SELECT channel_id FROM lockdown_channels WHERE guild_id = ?').all(guildId).map((r) => r.channel_id);
const clearLockdown = (guildId) =>
  db.prepare('DELETE FROM lockdown_channels WHERE guild_id = ?').run(guildId);

module.exports = {
  db, getSettings, updateSettings,
  addWarning, listWarnings, removeWarning, clearWarnings,
  addLockdownChannel, getLockdownChannels, clearLockdown,
};
