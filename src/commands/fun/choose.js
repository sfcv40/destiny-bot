const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('choose').setDescription('Let Destiny decide between options.')
    .addStringOption((o) => o.setName('options').setDescription('Options separated by commas').setRequired(true)),
  async execute(interaction) {
    const opts = interaction.options.getString('options').split(',').map((s) => s.trim()).filter(Boolean);
    if (opts.length < 2) return interaction.reply({ embeds: [embeds.error('Give me at least two options, separated by commas.')], flags: MessageFlags.Ephemeral });
    await interaction.reply({ embeds: [embeds.brand('✦ Destiny chooses', `**${opts[Math.floor(Math.random() * opts.length)]}**`)] });
  },
};
