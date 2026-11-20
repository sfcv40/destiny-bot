const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkHierarchy } = require('../../util/moderation');

module.exports = {
  data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete their messages from the last N days').setMinValue(0).setMaxValue(7)),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const member = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    const days = interaction.options.getInteger('delete_days') ?? 0;
    const problem = checkHierarchy(interaction, member);
    if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
    await interaction.guild.members.ban(user.id, { reason: `${interaction.user.tag}: ${reason}`, deleteMessageSeconds: days * 86400 });
    await interaction.reply({ embeds: [embeds.success(`Banned **${user.tag}**.\nReason: ${reason}`)] });
  },
};
