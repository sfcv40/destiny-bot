const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkTarget } = require('../../util/authority');

module.exports = {
  perm: P.ManageNicknames,
  data: new SlashCommandBuilder().setName('nick').setDescription('Change (or reset) a member\'s nickname.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageNicknames)
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('nickname').setDescription('New nickname (leave empty to reset)').setMaxLength(32)),
  async execute(interaction) {
    const member = interaction.options.getMember('user');
    if (!member) return interaction.reply({ embeds: [embeds.error('That user isn\'t in this server.')], flags: MessageFlags.Ephemeral });
    const problem = checkTarget(interaction, member, { allowSelf: true });
    if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
    const nick = interaction.options.getString('nickname');
    await member.setNickname(nick, `By ${interaction.user.tag}`);
    await interaction.reply({ embeds: [embeds.success(nick ? `${member} is now **${nick}**.` : `Reset ${member}'s nickname.`)] });
  },
};
