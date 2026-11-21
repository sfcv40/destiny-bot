const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkTarget } = require('../../util/authority');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.BanMembers,
  data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user (works even if they left).')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Delete their messages from the last N days').setMinValue(0).setMaxValue(7))
    .addBooleanOption((o) => o.setName('soft').setDescription('Softban: ban then unban, just to wipe messages')),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    const soft = interaction.options.getBoolean('soft') ?? false;
    const days = interaction.options.getInteger('delete_days') ?? (soft ? 1 : 0);
    const problem = checkTarget(interaction, interaction.options.getMember('user'));
    if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
    await user.send({ embeds: [embeds.warn(`You were ${soft ? 'kicked' : 'banned'} from **${interaction.guild.name}**.\nReason: ${reason}`)] }).catch(() => {});
    await interaction.guild.members.ban(user.id, { reason: `${interaction.user.tag}: ${reason}`, deleteMessageSeconds: days * 86400 });
    if (soft) await interaction.guild.members.unban(user.id, 'Softban');
    await interaction.reply({ embeds: [embeds.success(`${soft ? 'Softbanned' : 'Banned'} **${user.tag}**. Reason: ${reason}`)] });
    modlog(interaction.guild, { action: soft ? 'Softban' : 'Ban', moderator: interaction.user, target: `${user.tag} (${user.id})`, reason });
  },
};
