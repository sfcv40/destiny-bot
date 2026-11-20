const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('roll').setDescription('Roll dice.')
    .addIntegerOption((o) => o.setName('sides').setDescription('Sides per die (default 6)').setMinValue(2).setMaxValue(1000))
    .addIntegerOption((o) => o.setName('count').setDescription('Number of dice (default 1)').setMinValue(1).setMaxValue(20)),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') ?? 6;
    const count = interaction.options.getInteger('count') ?? 1;
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    await interaction.reply({
      embeds: [embeds.brand(`✦ ${count}d${sides}`, count > 1 ? `${rolls.join(' + ')} = **${total}**` : `**${total}**`)],
    });
  },
};
