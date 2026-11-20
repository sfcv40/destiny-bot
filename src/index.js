require('dotenv').config();
const path = require('node:path');
const { Client, GatewayIntentBits, Events, ActivityType, MessageFlags } = require('discord.js');
const loadCommands = require('./loadCommands');
const embeds = require('./util/embeds');
const { isAdmin } = require('./util/permissions');
const tickets = require('./ticketsDb');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = loadCommands();

// Register slash commands straight to each server so they appear instantly —
// no separate deploy step needed, which means the bot can be set up entirely from a host's web panel.
const commandBody = [...client.commands.values()].map((c) => c.data.toJSON());

async function registerCommands(guild) {
  try {
    await guild.commands.set(commandBody);
    console.log(`✦ Registered ${commandBody.length} commands in "${guild.name}".`);
  } catch (err) {
    console.warn(`Could not register commands in "${guild.name}": ${err.message}. ` +
      'Re-invite the bot with the applications.commands scope.');
  }
}

client.on(Events.GuildCreate, registerCommands);

// If someone deletes a ticket channel by hand, mark the ticket closed so the member can open a new one.
client.on(Events.ChannelDelete, (channel) => {
  tickets.closeTicket(channel.id, client.user.id, 'Channel was deleted');
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✦ Destiny is online as ${c.user.tag} in ${c.guilds.cache.size} server(s).`);
  c.user.setActivity('/generate ✦', { type: ActivityType.Watching });

  if (c.guilds.cache.size === 0) {
    const invite = `https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot%20applications.commands&permissions=1101927672854`;
    console.log(`✦ Destiny isn't in any servers yet. Invite it with:\n  ${invite}`);
  }
  for (const guild of c.guilds.cache.values()) await registerCommands(guild);

  // Give Destiny its profile picture the first time it starts without one.
  // (Discord rate-limits avatar changes, so this only runs when no avatar is set.)
  if (!c.user.avatar) {
    c.user.setAvatar(path.join(__dirname, '..', 'assets', 'avatar.png'))
      .then(() => console.log('✦ Profile picture set.'))
      .catch((err) => console.warn('Could not set profile picture:', err.message));
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.adminOnly && !isAdmin(interaction)) return interaction.respond([]);
      return await cmd?.autocomplete?.(interaction);
    }

    if (interaction.isButton()) {
      const cmd = client.commands.get(interaction.customId.split('-')[0]);
      if (cmd?.adminOnly && !isAdmin(interaction)) return;
      return await cmd?.button?.(interaction);
    }

    if (interaction.isModalSubmit()) {
      const cmd = client.commands.get(interaction.customId.split('-')[0]);
      if (cmd?.adminOnly && !isAdmin(interaction)) return;
      return await cmd?.modal?.(interaction);
    }

    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    // Belt-and-braces: default permissions can be overridden by server admins, so re-check here.
    if (cmd.adminOnly && !isAdmin(interaction)) {
      return interaction.reply({ embeds: [embeds.error('You need **Manage Server** to use this.')], flags: MessageFlags.Ephemeral });
    }

    await cmd.execute(interaction);
  } catch (err) {
    console.error(`Error handling ${interaction.commandName ?? interaction.customId}:`, err);
    if (!interaction.isRepliable()) return;
    const payload = { embeds: [embeds.error('Something broke while running that. Try again in a moment.')], flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(process.env.DISCORD_TOKEN.trim()).catch((err) => {
  if (err.code === 'TokenInvalid') {
    console.error('✧ Discord rejected the token. Reset it in the Developer Portal (Bot → Reset Token) and update DISCORD_TOKEN.');
  } else if (/disallowed intents/i.test(err.message)) {
    console.error('✧ Discord refused the requested intents. Check the Bot page in the Developer Portal.');
  } else {
    console.error('✧ Could not log in to Discord:', err.message);
  }
  process.exit(1);
});
