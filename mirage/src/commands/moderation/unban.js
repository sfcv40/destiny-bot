const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.BanMembers,
  data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.BanMembers)
    .addStringOption((o) => o.setName('user_id').setDescription('Their user ID').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),
  async execute(interaction) {
    const id = interaction.options.getString('user_id').replace(/\D/g, '');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    const user = await interaction.guild.members.unban(id, `${interaction.user.tag}: ${reason}`).catch(() => null);
    if (!user) return interaction.reply({ embeds: [embeds.error('That user isn\'t banned (or the ID is wrong).')], flags: MessageFlags.Ephemeral });
    await interaction.reply({ embeds: [embeds.success(`Unbanned **${user.tag}**.`)] });
    modlog(interaction.guild, { action: 'Unban', moderator: interaction.user, target: `${user.tag} (${user.id})`, reason });
  },
};
