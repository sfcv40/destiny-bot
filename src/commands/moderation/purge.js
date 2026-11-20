const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('purge').setDescription('Bulk delete recent messages.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('How many (1–100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user')),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (user) messages = messages.filter((m) => m.author.id === user.id);
    const deleted = await interaction.channel.bulkDelete([...messages.values()].slice(0, amount), true);
    await interaction.editReply({ embeds: [embeds.success(`Deleted ${deleted.size} message(s). Messages older than 14 days can't be bulk deleted.`)] });
  },
};
