const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check Mirage\'s latency.'),
  async execute(interaction) {
    await interaction.reply({ embeds: [embeds.brand('✦ Pong', `Gateway: ${Math.round(interaction.client.ws.ping)}ms`)] });
  },
};
