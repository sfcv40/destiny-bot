const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('avatar').setDescription('Show a user\'s avatar.')
    .addUserOption((o) => o.setName('user').setDescription('User (default: you)')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const url = user.displayAvatarURL({ size: 1024 });
    await interaction.reply({ embeds: [embeds.brand(`${user.username}'s avatar`).setURL(url).setImage(url)] });
  },
};
