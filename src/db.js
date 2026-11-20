const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'destiny.db'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'default',
    username    TEXT    NOT NULL,
    key         TEXT    NOT NULL,
    added_by    TEXT,
    added_at    INTEGER NOT NULL,
    claimed_by  TEXT,
    claimed_at  INTEGER,
    UNIQUE (guild_id, category, username, key)
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_available
    ON accounts (guild_id, category, claimed_by);

  CREATE TABLE IF NOT EXISTS claims (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT    NOT NULL,
    account_id  INTEGER NOT NULL,
    user_id     TEXT    NOT NULL,
    claimed_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_claims_user ON claims (guild_id, user_id, claimed_at);

  CREATE TABLE IF NOT EXISTS cooldowns (
    guild_id  TEXT    NOT NULL,
    user_id   TEXT    NOT NULL,
    last_at   INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id          TEXT PRIMARY KEY,
    cooldown_seconds  INTEGER NOT NULL DEFAULT 3600,
    required_role_id  TEXT,
    log_channel_id    TEXT,
    delivery          TEXT    NOT NULL DEFAULT 'dm',
    reuse             INTEGER NOT NULL DEFAULT 0
  );
`);

const DEFAULT_CATEGORY = 'default';
const normCategory = (c) => (c || DEFAULT_CATEGORY).trim().toLowerCase().slice(0, 50) || DEFAULT_CATEGORY;

// ---------- settings ----------
const stmtGetSettings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
const stmtInsertSettings = db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)');
const SETTING_COLUMNS = new Set(['cooldown_seconds', 'required_role_id', 'log_channel_id', 'delivery', 'reuse']);

function getSettings(guildId) {
  stmtInsertSettings.run(guildId);
  return stmtGetSettings.get(guildId);
}

function updateSetting(guildId, column, value) {
  if (!SETTING_COLUMNS.has(column)) throw new Error(`Unknown setting: ${column}`);
  stmtInsertSettings.run(guildId);
  db.prepare(`UPDATE guild_settings SET ${column} = ? WHERE guild_id = ?`).run(value, guildId);
  return getSettings(guildId);
}

// ---------- stock ----------
const stmtInsertAccount = db.prepare(`
  INSERT OR IGNORE INTO accounts (guild_id, category, username, key, added_by, added_at)
  VALUES (@guildId, @category, @username, @key, @addedBy, @addedAt)
`);

/** Add many accounts at once. Returns { added, duplicates }. */
const addAccounts = db.transaction((guildId, category, entries, addedBy) => {
  const cat = normCategory(category);
  const now = Date.now();
  let added = 0;
  for (const { username, key } of entries) {
    const res = stmtInsertAccount.run({ guildId, category: cat, username, key, addedBy, addedAt: now });
    added += res.changes;
  }
  return { added, duplicates: entries.length - added };
});

const stmtPickAvailable = db.prepare(`
  SELECT * FROM accounts
  WHERE guild_id = ? AND category = ? AND claimed_by IS NULL
  ORDER BY RANDOM() LIMIT 1
`);
const stmtPickAny = db.prepare(`
  SELECT * FROM accounts WHERE guild_id = ? AND category = ? ORDER BY RANDOM() LIMIT 1
`);
const stmtMarkClaimed = db.prepare('UPDATE accounts SET claimed_by = ?, claimed_at = ? WHERE id = ?');
const stmtLogClaim = db.prepare('INSERT INTO claims (guild_id, account_id, user_id, claimed_at) VALUES (?, ?, ?, ?)');
const stmtSetCooldown = db.prepare(`
  INSERT INTO cooldowns (guild_id, user_id, last_at) VALUES (?, ?, ?)
  ON CONFLICT (guild_id, user_id) DO UPDATE SET last_at = excluded.last_at
`);

/**
 * Pick a random account and hand it to a user.
 * In one-time mode (default) the account is marked as claimed so nobody else gets it.
 * In reuse mode any account can be handed out again.
 */
const claimRandom = db.transaction((guildId, category, userId, reuse) => {
  const cat = normCategory(category);
  const account = reuse ? stmtPickAny.get(guildId, cat) : stmtPickAvailable.get(guildId, cat);
  if (!account) return null;
  const now = Date.now();
  if (!reuse) stmtMarkClaimed.run(userId, now, account.id);
  stmtLogClaim.run(guildId, account.id, userId, now);
  stmtSetCooldown.run(guildId, userId, now);
  return { ...account, claimed_by: reuse ? account.claimed_by : userId, claimed_at: now };
});

function stockSummary(guildId) {
  return db.prepare(`
    SELECT category,
           COUNT(*) AS total,
           SUM(CASE WHEN claimed_by IS NULL THEN 1 ELSE 0 END) AS available
    FROM accounts WHERE guild_id = ?
    GROUP BY category ORDER BY category
  `).all(guildId);
}

function listCategories(guildId) {
  return db.prepare('SELECT DISTINCT category FROM accounts WHERE guild_id = ? ORDER BY category')
    .all(guildId).map((r) => r.category);
}

function listAccounts(guildId, category, { includeClaimed = false, limit = 25, offset = 0 } = {}) {
  const cat = normCategory(category);
  return db.prepare(`
    SELECT * FROM accounts
    WHERE guild_id = ? AND category = ? ${includeClaimed ? '' : 'AND claimed_by IS NULL'}
    ORDER BY id LIMIT ? OFFSET ?
  `).all(guildId, cat, limit, offset);
}

function countAccounts(guildId, category, includeClaimed = false) {
  const cat = normCategory(category);
  return db.prepare(`
    SELECT COUNT(*) AS n FROM accounts
    WHERE guild_id = ? AND category = ? ${includeClaimed ? '' : 'AND claimed_by IS NULL'}
  `).get(guildId, cat).n;
}

function removeAccount(guildId, id) {
  return db.prepare('DELETE FROM accounts WHERE guild_id = ? AND id = ?').run(guildId, id).changes;
}

function clearAccounts(guildId, category, onlyClaimed = false) {
  const cat = normCategory(category);
  return db.prepare(`
    DELETE FROM accounts WHERE guild_id = ? AND category = ? ${onlyClaimed ? 'AND claimed_by IS NOT NULL' : ''}
  `).run(guildId, cat).changes;
}

function restockClaimed(guildId, category) {
  const cat = normCategory(category);
  return db.prepare(`
    UPDATE accounts SET claimed_by = NULL, claimed_at = NULL
    WHERE guild_id = ? AND category = ? AND claimed_by IS NOT NULL
  `).run(guildId, cat).changes;
}

function exportAccounts(guildId, category, includeClaimed = false) {
  return listAccounts(guildId, category, { includeClaimed, limit: -1 });
}

// ---------- claims / cooldowns ----------
function lastClaim(guildId, userId) {
  return db.prepare('SELECT last_at FROM cooldowns WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId)?.last_at ?? null;
}

function recentClaims(guildId, { userId = null, limit = 15 } = {}) {
  return db.prepare(`
    SELECT c.user_id, c.claimed_at, a.category, a.username
    FROM claims c LEFT JOIN accounts a ON a.id = c.account_id
    WHERE c.guild_id = ? ${userId ? 'AND c.user_id = ?' : ''}
    ORDER BY c.claimed_at DESC LIMIT ?
  `).all(...[guildId, userId, limit].filter((v) => v !== null));
}

function resetCooldown(guildId, userId) {
  return db.prepare('DELETE FROM cooldowns WHERE guild_id = ? AND user_id = ?').run(guildId, userId).changes;
}

module.exports = {
  db,
  DEFAULT_CATEGORY,
  normCategory,
  getSettings,
  updateSetting,
  addAccounts,
  claimRandom,
  stockSummary,
  listCategories,
  listAccounts,
  countAccounts,
  removeAccount,
  clearAccounts,
  restockClaimed,
  exportAccounts,
  lastClaim,
  recentClaims,
  resetCooldown,
};
