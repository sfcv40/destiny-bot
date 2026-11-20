const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check Destiny\'s latency.'),
  async execute(interaction) {
    const sent = await interaction.reply({ embeds: [embeds.brand('Pinging…')], withResponse: true });
    const rtt = sent.resource.message.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [embeds.brand('✦ Pong').addFields(
        { name: 'Round trip', value: `${rtt}ms`, inline: true },
        { name: 'Gateway', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
      )],
    });
  },
};
