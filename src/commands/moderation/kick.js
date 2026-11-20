const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkHierarchy } = require('../../util/moderation');

module.exports = {
  data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    if (!member) return interaction.reply({ embeds: [embeds.error('That user isn\'t in this server.')], flags: MessageFlags.Ephemeral });
    const problem = checkHierarchy(interaction, member);
    if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
    await member.kick(`${interaction.user.tag}: ${reason}`);
    await interaction.reply({ embeds: [embeds.success(`Kicked **${member.user.tag}**.\nReason: ${reason}`)] });
  },
};
