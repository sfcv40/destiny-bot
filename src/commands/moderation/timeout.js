const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkHierarchy } = require('../../util/moderation');
const { parseDuration, formatDuration } = require('../../util/time');

module.exports = {
  data: new SlashCommandBuilder().setName('timeout').setDescription('Time out a member (0 to remove).')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 1h, 1d (max 28d), 0 to remove').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    const secs = parseDuration(interaction.options.getString('duration'));
    const reason = interaction.options.getString('reason') ?? 'No reason given';
    const eph = (e) => interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });
    if (!member) return eph(embeds.error('That user isn\'t in this server.'));
    if (secs === null || secs > 28 * 86400) return eph(embeds.error('Use a duration like `10m`, `1h`, `1d` (max 28d), or `0`.'));
    const problem = checkHierarchy(interaction, member);
    if (problem) return eph(problem);
    await member.timeout(secs ? secs * 1000 : null, `${interaction.user.tag}: ${reason}`);
    await interaction.reply({
      embeds: [embeds.success(secs
        ? `Timed out **${member.user.tag}** for ${formatDuration(secs)}.\nReason: ${reason}`
        : `Removed timeout from **${member.user.tag}**.`)],
    });
  },
};
