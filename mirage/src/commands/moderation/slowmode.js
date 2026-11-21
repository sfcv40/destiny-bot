const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags, ChannelType } = require('discord.js');
const embeds = require('../../util/embeds');
const { parseDuration, formatDuration } = require('../../util/time');

module.exports = {
  perm: P.ManageChannels,
  data: new SlashCommandBuilder().setName('slowmode').setDescription('Set a channel\'s slowmode (0 to turn off).')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageChannels)
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 5s, 1m, 2h (max 6h), 0 to turn off').setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(ChannelType.GuildText)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const secs = parseDuration(interaction.options.getString('duration'));
    if (secs === null || secs > 21600) return interaction.reply({ embeds: [embeds.error('Use something like `5s`, `1m`, `2h` (max 6h), or `0`.')], flags: MessageFlags.Ephemeral });
    await channel.setRateLimitPerUser(secs, `By ${interaction.user.tag}`);
    await interaction.reply({ embeds: [embeds.success(secs ? `Slowmode in ${channel} set to ${formatDuration(secs)}.` : `Slowmode off in ${channel}.`)] });
  },
};
