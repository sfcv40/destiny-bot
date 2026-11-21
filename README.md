# ✦ Destiny

<img src="assets/avatar.png" width="120" align="right" alt="Destiny avatar">

![Destiny](assets/banner.png)

> This repo also contains **[Mirage](mirage/)**, a separate all-powerful server management bot, in the `mirage/` folder.

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

**Support tickets**
1. `/ticket setup support_role:@Staff category:Tickets log_channel:#ticket-logs`. Every option is optional.
2. `/ticket panel` posts an **Open a ticket** button. Members press it, say what they need, and get a private channel. Only the member and the support role can see it.
3. Inside a ticket, use the **Claim** and **Close** buttons. Staff also have `/ticket add`, `/ticket remove`, `/ticket rename` and `/ticket claim`, and `/ticket close [reason]` works too.
4. When a ticket closes, a `.txt` transcript is sent to the log channel and DM'd to the member, and the channel is deleted.

Each member can have one open ticket at a time. The bot needs **Manage Channels** and **Manage Roles**, which the invite link below includes. To get message text in transcripts, turn on **Message Content Intent** in the Developer Portal → Bot.

**General:** `/say` (send a message as Destiny), `/help`, `/ping`, `/botinfo`, `/serverinfo`, `/userinfo`, `/avatar`
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

## Setup (works entirely from a phone)

Tip: switch your phone browser to **Desktop site** for these pages.

**1. Create the bot**
1. Go to <https://discord.com/developers/applications> → **New Application** → name it `Destiny`.
2. Go to **Bot** → **Reset Token**, then copy the token and keep it secret.
3. On the same page, tap the icon to upload `assets/avatar.png` as the profile picture. You can skip this, because Destiny sets the picture itself on first start.

**2. Invite it to your server.** Open this link, replacing `APP_ID` with the **Application ID** from **General Information**:
```
https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot%20applications.commands&permissions=1101927672854
```

**3. Host it on [Railway](https://railway.app)**
1. Sign in with GitHub → **New Project** → **Deploy from GitHub repo** → pick `destiny-bot`.
2. If the code isn't on your main branch yet: **Settings** → **Source** → set the branch to the one with the bot.
3. **Variables** → add `DISCORD_TOKEN` = your token.
4. **Add a Volume** to the service, mounted at `/data`. Then add the variable `DATABASE_PATH` = `/data/destiny.db`.
   **Don't skip this.** Without a volume, every redeploy wipes your stock.
5. Railway installs and runs the bot automatically (`npm start`).

**4. Check it's working.** Open **Deployments** → **View logs**. You should see:
```
✦ Destiny is online as Destiny#1234 in 1 server(s).
✦ Registered 18 commands in "Your Server".
```
The slash commands appear in your server straight away; you don't need a deploy step. If they don't show, fully close and reopen Discord.

**5. Use it:** `/stock paste` to add accounts, then `/generate`.

### Troubleshooting
| Log says | Fix |
|---|---|
| `Discord rejected the token` | Reset the token and paste it into `DISCORD_TOKEN` again (no spaces) |
| `isn't in any servers yet` | Use the invite link printed in the log |
| `Could not register commands` | Re-invite with the link above (it includes `applications.commands`) |
| Bot online but commands missing | Restart Discord. Make sure you're in the server you invited it to |

### Running on a computer instead
```bash
npm install
cp .env.example .env   # set DISCORD_TOKEN
npm start
```
You need Node.js 18.17 or newer. `npm run check` runs an offline self-test.

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
