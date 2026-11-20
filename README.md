# ✦ Destiny

![Destiny](assets/banner.png)

A multipurpose Discord bot. Its signature feature: **`/generate` hands a member a random username and key from a private stock that you fill.**

## Features

**Accounts**
- `/generate [category]`: gives the member a random username + key by DM. If their DMs are closed, they get a private reply instead.
- Each account goes out **once** by default, so no two people get the same one. You can turn on reuse with `/config reuse`.
- Categories (e.g. `netflix`, `spotify`) let you keep separate stocks. Category names autocomplete.
- Per-member cooldown, an optional required role, and an optional log channel. The log shows the username but never the key.

**Stock management** (needs Manage Server)
| Command | What it does |
|---|---|
| `/stock add` | Add one username + key |
| `/stock upload` | Bulk add from a `.txt` file |
| `/stock paste` | Bulk add by pasting into a pop-up form |
| `/stock view` | Available / total per category |
| `/stock list` | Page through accounts (keys hidden behind spoilers; only you see it) |
| `/stock remove` | Remove one account by ID |
| `/stock clear` | Delete a category, or only its given-out accounts |
| `/stock restock` | Put given-out accounts back into stock |
| `/stock export` | Download a category as `username:key` lines |
| `/stock history` | Who generated what, and when |

**Config** (needs Manage Server): `/config view | cooldown | role | logchannel | delivery | reuse | resetcooldown`

**General:** `/help`, `/ping`, `/botinfo`, `/serverinfo`, `/userinfo`, `/avatar`
**Fun:** `/8ball`, `/coinflip`, `/roll`, `/choose`
**Moderation:** `/kick`, `/ban`, `/timeout`, `/purge`

### Stock file format

Put one account on each line. You can separate the username and key with `:`, `|`, `;`, `,`, a tab, or a space. Blank lines and lines starting with `#` are skipped, and duplicates are ignored.

```
# my accounts
coolguy01:AAAA-BBBB-CCCC
nightowl | 9f8e7d6c
stardust KEY-12345
```

## Setup

1. Create an application at <https://discord.com/developers/applications>. Under **Bot**, reset the token and copy it.
2. Invite the bot. In **OAuth2 → URL Generator**, tick the `bot` and `applications.commands` scopes. Then tick these permissions: Send Messages, Embed Links, Attach Files, Kick Members, Ban Members, Moderate Members, Manage Messages.
3. Install and configure:
   ```bash
   npm install
   cp .env.example .env   # fill in DISCORD_TOKEN and CLIENT_ID (GUILD_ID for instant dev registration)
   npm run deploy         # register slash commands
   npm start
   ```
4. In your server, run `/stock upload` with your file, then `/generate`.

You need Node.js 18.17 or newer. Data is stored in SQLite at `data/destiny.db`, which git ignores. Back it up, because it holds your keys.

`npm run check` runs an offline self-test of the commands and the database.

## Project layout

```
src/
  index.js            bot entry point and interaction router
  deploy-commands.js  registers slash commands with Discord
  db.js               SQLite schema and queries
  commands/<section>/ one file per slash command (accounts, admin, general, fun, moderation)
  util/               embeds, permissions, parsing helpers
```

To add a command, drop a file into `src/commands/<section>/` that exports `{ data, execute }`. Then run `npm run deploy`.
