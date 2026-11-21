const { SlashCommandBuilder } = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { isOwner } = require('../../util/authority');

module.exports = {
  data: new SlashCommandBuilder().setName('userinfo').setDescription('Info about a user.')
    .addUserOption((o) => o.setName('user').setDescription('User (default: you)')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;
    const e = embeds.brand(user.tag + (isOwner(user.id, interaction.guild) ? ' ✦ Owner' : '')).setThumbnail(user.displayAvatarURL({ size: 256 })).addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
    );
    if (member) {
      e.addFields(
        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Warnings', value: String(db.listWarnings(interaction.guildId, user.id).length), inline: true },
      );
      const roles = member.roles.cache.filter((r) => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position);
      if (roles.size) e.addFields({ name: `Roles (${roles.size})`, value: roles.map(String).slice(0, 20).join(' ') });
    }
    await interaction.reply({ embeds: [e] });
  },
};
