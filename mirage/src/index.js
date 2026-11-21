require('dotenv').config();
const path = require('node:path');
const { Client, GatewayIntentBits, Events, ActivityType, MessageFlags } = require('discord.js');
const loadCommands = require('./loadCommands');
const db = require('./db');
const embeds = require('./util/embeds');
const { hasPerm } = require('./util/authority');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const commands = loadCommands();
const commandBody = [...commands.values()].map((c) => c.data.toJSON());
const INVITE_PERMS = '8'; // Administrator

function buildClient(withMembers) {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration];
  if (withMembers) intents.push(GatewayIntentBits.GuildMembers);
  const client = new Client({ intents });
  client.commands = commands;

  async function registerCommands(guild) {
    try {
      await guild.commands.set(commandBody);
      console.log(`✦ Registered ${commandBody.length} commands in "${guild.name}".`);
    } catch (err) {
      console.warn(`Could not register commands in "${guild.name}": ${err.message}`);
    }
  }

  client.on(Events.GuildCreate, registerCommands);

  client.once(Events.ClientReady, async (c) => {
    console.log(`✦ Mirage is online as ${c.user.tag} in ${c.guilds.cache.size} server(s).`);
    c.user.setActivity('over everything', { type: ActivityType.Watching });
    if (!c.guilds.cache.size) {
      console.log(`✦ Mirage isn't in any servers yet. Invite it with:\n  https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot%20applications.commands&permissions=${INVITE_PERMS}`);
    }
    for (const guild of c.guilds.cache.values()) await registerCommands(guild);
    if (!c.user.avatar) {
      c.user.setAvatar(path.join(__dirname, '..', 'assets', 'avatar.png'))
        .then(() => console.log('✦ Profile picture set.'))
        .catch((err) => console.warn('Could not set profile picture:', err.message));
    }
    if (!c.user.banner) {
      c.user.edit({ banner: path.join(__dirname, '..', 'assets', 'banner.png') })
        .then(() => console.log('✦ Profile banner set.'))
        .catch((err) => console.warn('Could not set profile banner:', err.message));
    }
  });

  // Welcome message + auto-role (needs Server Members Intent).
  client.on(Events.GuildMemberAdd, async (member) => {
    const s = db.getSettings(member.guild.id);
    if (s.autorole_id) {
      await member.roles.add(s.autorole_id, 'Auto-role').catch((err) => console.warn('Auto-role failed:', err.message));
    }
    const channel = s.welcome_channel_id && member.guild.channels.cache.get(s.welcome_channel_id);
    if (channel?.isTextBased()) {
      const text = (s.welcome_message || 'Welcome to **{server}**, {user}. You are member #{count}.')
        .replace(/\\n/g, '\n').replaceAll('{user}', `${member}`).replaceAll('{server}', member.guild.name)
        .replaceAll('{count}', String(member.guild.memberCount));
      await channel.send({
        content: `${member}`,
        embeds: [embeds.brand('✦ Welcome', text).setThumbnail(member.user.displayAvatarURL())],
        allowedMentions: { users: [member.id] },
      }).catch(() => {});
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      const name = interaction.isModalSubmit() || interaction.isButton() ? interaction.customId.split('-')[0] : interaction.commandName;
      const cmd = commands.get(name);
      if (!cmd) return;

      // Re-check permissions at runtime: a server's command settings can override the defaults.
      if (cmd.perm && !hasPerm(interaction, cmd.perm)) {
        if (interaction.isAutocomplete()) return interaction.respond([]);
        return interaction.reply({ embeds: [embeds.error('You don\'t have permission to use this.')], flags: MessageFlags.Ephemeral });
      }

      if (interaction.isAutocomplete()) return await cmd.autocomplete?.(interaction);
      if (interaction.isModalSubmit()) return await cmd.modal?.(interaction);
      if (interaction.isButton()) return await cmd.button?.(interaction);
      if (interaction.isChatInputCommand()) return await cmd.execute(interaction);
    } catch (err) {
      console.error(`Error handling ${interaction.commandName ?? interaction.customId}:`, err);
      if (!interaction.isRepliable()) return;
      const msg = err.code === 50013
        ? 'Discord said I\'m missing permissions for that. Run `/server check`: my role may need to be higher.'
        : 'Something broke while running that. Try again in a moment.';
      const payload = { embeds: [embeds.error(msg)], flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  });

  return client;
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

// Try with Server Members Intent first; if it isn't enabled in the Developer Portal, start without it.
async function start(withMembers = true) {
  const client = buildClient(withMembers);
  try {
    await client.login(process.env.DISCORD_TOKEN.trim());
    if (!withMembers) console.warn('⚠ Running without Server Members Intent: welcome, auto-role and /role all are disabled. Turn it on in the Developer Portal → Bot.');
  } catch (err) {
    if (withMembers && /disallowed intents/i.test(err.message)) {
      await client.destroy();
      return start(false);
    }
    if (err.code === 'TokenInvalid') console.error('✧ Discord rejected the token. Reset it in the Developer Portal (Bot → Reset Token) and update DISCORD_TOKEN.');
    else console.error('✧ Could not log in to Discord:', err.message);
    process.exit(1);
  }
}

start();
