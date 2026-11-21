const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkTarget } = require('../../util/authority');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.KickMembers,
  data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    if (!member) return interaction.reply({ embeds: [embeds.error('That user isn\'t in this server.')], flags: MessageFlags.Ephemeral });
    const problem = checkTarget(interaction, member);
    if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
    await member.send({ embeds: [embeds.warn(`You were kicked from **${interaction.guild.name}**.\nReason: ${reason}`)] }).catch(() => {});
    await member.kick(`${interaction.user.tag}: ${reason}`);
    await interaction.reply({ embeds: [embeds.success(`Kicked **${member.user.tag}**. Reason: ${reason}`)] });
    modlog(interaction.guild, { action: 'Kick', moderator: interaction.user, target: `${member.user.tag} (${member.id})`, reason });
  },
};
