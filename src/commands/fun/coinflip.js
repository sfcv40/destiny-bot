const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin.'),
  async execute(interaction) {
    await interaction.reply({ embeds: [embeds.brand(`✦ ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`)] });
  },
};
