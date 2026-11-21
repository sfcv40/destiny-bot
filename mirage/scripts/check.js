// Offline sanity check: loads every command, validates its JSON, and exercises the database.
process.env.DATABASE_PATH = require('node:path').join(require('node:os').tmpdir(), `mirage-check-${process.pid}.db`);
process.env.OWNER_IDS = 'owner1';
const assert = require('node:assert');
const fs = require('node:fs');
const loadCommands = require('../src/loadCommands');
const db = require('../src/db');
const { parseDuration } = require('../src/util/time');
const { isOwner } = require('../src/util/authority');

const cmds = loadCommands();
let total = 0;
for (const c of cmds.values()) { const j = c.data.toJSON(); total += 1 + (j.options ?? []).filter((o) => o.type === 1).length; }
console.log(`commands ok (${cmds.size} commands, ${total} entries): ${[...cmds.keys()].join(', ')}`);

assert.strictEqual(parseDuration('1h30m'), 5400);
assert.strictEqual(parseDuration('10 m'), 600);
assert.strictEqual(parseDuration('abc'), null);
assert.ok(isOwner('owner1', null));
assert.ok(isOwner('x', { ownerId: 'x' }));
assert.ok(!isOwner('y', { ownerId: 'x' }));

const g = 'g';
db.updateSettings(g, { modlog_channel_id: 'c1', autorole_id: 'r1' });
assert.strictEqual(db.getSettings(g).autorole_id, 'r1');
const id = db.addWarning(g, 'u', 'm', 'spam');
db.addWarning(g, 'u', 'm', 'more spam');
assert.strictEqual(db.listWarnings(g, 'u').length, 2);
assert.strictEqual(db.removeWarning(g, id), 1);
assert.strictEqual(db.clearWarnings(g, 'u'), 1);
db.addLockdownChannel(g, 'a'); db.addLockdownChannel(g, 'a'); db.addLockdownChannel(g, 'b');
assert.deepStrictEqual(db.getLockdownChannels(g).sort(), ['a', 'b']);
db.clearLockdown(g);
assert.strictEqual(db.getLockdownChannels(g).length, 0);

db.db.close();
for (const s of ['', '-wal', '-shm']) fs.rmSync(process.env.DATABASE_PATH + s, { force: true });
console.log('database ok');
