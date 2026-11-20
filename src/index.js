require('dotenv').config();
const path = require('node:path');
const { Client, GatewayIntentBits, Events, ActivityType, MessageFlags } = require('discord.js');
const loadCommands = require('./loadCommands');
const embeds = require('./util/embeds');
const { isAdmin } = require('./util/permissions');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = loadCommands();

client.once(Events.ClientReady, (c) => {
  console.log(`✦ Destiny is online as ${c.user.tag} in ${c.guilds.cache.size} server(s).`);
  c.user.setActivity('/generate ✦', { type: ActivityType.Watching });

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

client.login(process.env.DISCORD_TOKEN);
