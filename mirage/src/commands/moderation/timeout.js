const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkTarget } = require('../../util/authority');
const { parseDuration, formatDuration } = require('../../util/time');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.ModerateMembers,
  data: new SlashCommandBuilder().setName('timeout').setDescription('Time out a member (duration 0 removes it).')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 1h, 1d (max 28d), 0 to remove').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const secs = parseDuration(interaction.options.getString('duration'));
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    if (!member) return interaction.reply({ embeds: [embeds.error('That user isn\'t in this server.')], flags: MessageFlags.Ephemeral });
    if (secs === null || secs > 28 * 86400) return interaction.reply({ embeds: [embeds.error('Use a duration like `10m`, `1h`, `1d` (max 28d), or `0`.')], flags: MessageFlags.Ephemeral });
    const problem = checkTarget(interaction, member);
    if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
    await member.timeout(secs ? secs * 1000 : null, `${interaction.user.tag}: ${reason}`);
    const text = secs ? `Timed out **${member.user.tag}** for ${formatDuration(secs)}.` : `Removed timeout from **${member.user.tag}**.`;
    await interaction.reply({ embeds: [embeds.success(text)] });
    modlog(interaction.guild, { action: secs ? `Timeout (${formatDuration(secs)})` : 'Timeout removed', moderator: interaction.user, target: `${member.user.tag} (${member.id})`, reason });
  },
};
