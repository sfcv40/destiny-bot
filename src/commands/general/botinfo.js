const { SlashCommandBuilder, version: djsVersion } = require('discord.js');
const embeds = require('../../util/embeds');
const { formatDuration } = require('../../util/time');

module.exports = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription('Stats about Destiny.'),
  async execute(interaction) {
    const c = interaction.client;
    await interaction.reply({
      embeds: [embeds.brand('✦ Destiny').setThumbnail(c.user.displayAvatarURL()).addFields(
        { name: 'Servers', value: String(c.guilds.cache.size), inline: true },
        { name: 'Uptime', value: formatDuration(process.uptime()), inline: true },
        { name: 'Memory', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'discord.js', value: `v${djsVersion}`, inline: true },
      )],
    });
  },
};
