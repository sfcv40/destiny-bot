const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.ManageMessages,
  data: new SlashCommandBuilder().setName('purge').setDescription('Bulk delete recent messages.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('How many (1–500)').setRequired(true).setMinValue(1).setMaxValue(500))
    .addUserOption((o) => o.setName('user').setDescription('Only messages from this user'))
    .addBooleanOption((o) => o.setName('bots').setDescription('Only messages from bots'))
    .addStringOption((o) => o.setName('contains').setDescription('Only messages containing this text')),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    const bots = interaction.options.getBoolean('bots');
    const contains = interaction.options.getString('contains')?.toLowerCase();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cutoff = Date.now() - 14 * 86400 * 1000 + 60000;
    let deleted = 0;
    let before;
    for (let scanned = 0; deleted < amount && scanned < 2000; scanned += 100) {
      const batch = await interaction.channel.messages.fetch({ limit: 100, before });
      if (!batch.size) break;
      before = batch.last().id;
      const targets = [...batch.values()].filter((m) =>
        m.createdTimestamp > cutoff && !m.pinned &&
        (!user || m.author.id === user.id) && (!bots || m.author.bot) &&
        (!contains || m.content.toLowerCase().includes(contains))).slice(0, amount - deleted);
      if (targets.length) deleted += (await interaction.channel.bulkDelete(targets, true)).size;
      if (batch.last().createdTimestamp < cutoff) break;
    }
    await interaction.editReply({ embeds: [embeds.success(`Deleted ${deleted} message(s). Pinned messages and messages older than 14 days are skipped.`)] });
    modlog(interaction.guild, { action: 'Purge', moderator: interaction.user, extra: [{ name: 'Channel', value: `${interaction.channel}`, inline: true }, { name: 'Deleted', value: String(deleted), inline: true }] });
  },
};
