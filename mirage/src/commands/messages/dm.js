const { SlashCommandBuilder, PermissionFlagsBits: P, MessageFlags, InteractionContextType } = require('discord.js');
const embeds = require('../../util/embeds');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.ManageGuild,
  data: new SlashCommandBuilder().setName('dm').setDescription('Send a member a DM from Mirage.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageGuild)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('Message (use \\n for a new line)').setRequired(true).setMaxLength(2000)),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const text = interaction.options.getString('message').replace(/\\n/g, '\n');
    const ok = await user.send({ embeds: [embeds.brand(`✦ Message from ${interaction.guild.name}`, text)] }).then(() => true).catch(() => false);
    await interaction.reply({ embeds: [ok ? embeds.success(`DM sent to ${user}.`) : embeds.error(`${user} has DMs closed.`)], flags: MessageFlags.Ephemeral });
    if (ok) modlog(interaction.guild, { action: 'DM sent', moderator: interaction.user, target: user, reason: text });
  },
};
