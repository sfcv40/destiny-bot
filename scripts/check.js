// Offline sanity check: loads every command, validates its JSON, and exercises the database.
process.env.DATABASE_PATH = require('node:path').join(require('node:os').tmpdir(), `destiny-check-${process.pid}.db`);
const assert = require('node:assert');
const fs = require('node:fs');
const loadCommands = require('../src/loadCommands');
const db = require('../src/db');
const { parseAccounts } = require('../src/util/parseAccounts');
const { parseDuration } = require('../src/util/time');

const cmds = loadCommands();
for (const c of cmds.values()) c.data.toJSON();
console.log(`commands ok: ${[...cmds.keys()].join(', ')}`);

const { entries, invalid } = parseAccounts('# comment\nalice:KEY1\nbob | KEY2\ncarl KEY3\n\nbroken\n');
assert.deepStrictEqual(entries.map((e) => e.username), ['alice', 'bob', 'carl']);
assert.strictEqual(invalid.length, 1);
assert.strictEqual(parseDuration('1h30m'), 5400);
assert.strictEqual(parseDuration('0'), 0);
assert.strictEqual(parseDuration('abc'), null);

const g = 'guild';
assert.deepStrictEqual(db.addAccounts(g, 'Default', entries, 'admin'), { added: 3, duplicates: 0 });
assert.deepStrictEqual(db.addAccounts(g, 'default', entries.slice(0, 1), 'admin'), { added: 0, duplicates: 1 });
const got = new Set();
for (let i = 0; i < 3; i++) got.add(db.claimRandom(g, null, `user${i}`, false).username);
assert.strictEqual(got.size, 3, 'one-time mode must not repeat accounts');
assert.strictEqual(db.claimRandom(g, null, 'user9', false), null, 'empty stock returns null');
assert.ok(db.lastClaim(g, 'user0'));
db.resetCooldown(g, 'user0');
assert.strictEqual(db.lastClaim(g, 'user0'), null);
assert.strictEqual(db.restockClaimed(g, null), 3);
assert.ok(db.claimRandom(g, null, 'user1', true), 'reuse mode works');
assert.strictEqual(db.countAccounts(g, null), 3, 'reuse mode leaves stock untouched');
assert.strictEqual(db.recentClaims(g).length, 4);

const tickets = require('../src/ticketsDb');
assert.strictEqual(tickets.nextTicketNumber(g), 1);
assert.strictEqual(tickets.nextTicketNumber(g), 2);
tickets.updateTicketSettings(g, { support_role_id: 'role1' });
assert.strictEqual(tickets.getTicketSettings(g).support_role_id, 'role1');
tickets.createTicket({ guildId: g, channelId: 'chan1', userId: 'u1', number: 2, reason: 'help' });
assert.ok(tickets.getOpenTicketForUser(g, 'u1'));
assert.strictEqual(tickets.claimTicket('chan1', 'staff'), 1);
assert.strictEqual(tickets.closeTicket('chan1', 'staff', 'done'), 1);
assert.strictEqual(tickets.closeTicket('chan1', 'staff', 'again'), 0, 'cannot close twice');
assert.strictEqual(tickets.getOpenTicketForUser(g, 'u1'), undefined);
console.log('tickets ok');

db.db.close();
for (const s of ['', '-wal', '-shm']) fs.rmSync(process.env.DATABASE_PATH + s, { force: true });
console.log('database ok');
