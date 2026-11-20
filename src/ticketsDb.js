const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_settings (
    guild_id         TEXT PRIMARY KEY,
    category_id      TEXT,
    support_role_id  TEXT,
    log_channel_id   TEXT,
    counter          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT    NOT NULL,
    channel_id    TEXT    NOT NULL UNIQUE,
    user_id       TEXT    NOT NULL,
    number        INTEGER NOT NULL,
    reason        TEXT,
    status        TEXT    NOT NULL DEFAULT 'open',
    claimed_by    TEXT,
    opened_at     INTEGER NOT NULL,
    closed_at     INTEGER,
    closed_by     TEXT,
    close_reason  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (guild_id, user_id, status);
`);

const SETTING_COLUMNS = new Set(['category_id', 'support_role_id', 'log_channel_id']);

function getTicketSettings(guildId) {
  db.prepare('INSERT OR IGNORE INTO ticket_settings (guild_id) VALUES (?)').run(guildId);
  return db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
}

function updateTicketSettings(guildId, values) {
  getTicketSettings(guildId);
  for (const [col, val] of Object.entries(values)) {
    if (!SETTING_COLUMNS.has(col)) throw new Error(`Unknown ticket setting: ${col}`);
    db.prepare(`UPDATE ticket_settings SET ${col} = ? WHERE guild_id = ?`).run(val, guildId);
  }
  return getTicketSettings(guildId);
}

/** Reserve the next ticket number for a server. */
const nextTicketNumber = db.transaction((guildId) => {
  getTicketSettings(guildId);
  db.prepare('UPDATE ticket_settings SET counter = counter + 1 WHERE guild_id = ?').run(guildId);
  return db.prepare('SELECT counter FROM ticket_settings WHERE guild_id = ?').get(guildId).counter;
});

function createTicket({ guildId, channelId, userId, number, reason }) {
  db.prepare(`
    INSERT INTO tickets (guild_id, channel_id, user_id, number, reason, opened_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(guildId, channelId, userId, number, reason, Date.now());
  return getTicketByChannel(channelId);
}

const getTicketByChannel = (channelId) =>
  db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);

const getOpenTicketForUser = (guildId, userId) =>
  db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(guildId, userId);

const claimTicket = (channelId, userId) =>
  db.prepare("UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = 'open'").run(userId, channelId).changes;

const closeTicket = (channelId, closedBy, reason) =>
  db.prepare(`
    UPDATE tickets SET status = 'closed', closed_at = ?, closed_by = ?, close_reason = ?
    WHERE channel_id = ? AND status = 'open'
  `).run(Date.now(), closedBy, reason, channelId).changes;

module.exports = {
  getTicketSettings,
  updateTicketSettings,
  nextTicketNumber,
  createTicket,
  getTicketByChannel,
  getOpenTicketForUser,
  claimTicket,
  closeTicket,
};
