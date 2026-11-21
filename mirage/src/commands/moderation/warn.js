const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags } = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { checkTarget } = require('../../util/authority');
const { modlog } = require('../../util/modlog');

module.exports = {
  perm: P.ModerateMembers,
  data: new SlashCommandBuilder().setName('warn').setDescription('Warnings.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ModerateMembers)
    .addSubcommand((s) => s.setName('add').setDescription('Warn a member.')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(400)))
    .addSubcommand((s) => s.setName('list').setDescription('See a member\'s warnings.')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove one warning by ID.')
      .addIntegerOption((o) => o.setName('id').setDescription('Warning ID').setRequired(true)))
    .addSubcommand((s) => s.setName('clear').setDescription('Clear all of a member\'s warnings.')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const g = interaction.guildId;
    const user = interaction.options.getUser('user');
    if (sub === 'add') {
      const problem = checkTarget(interaction, interaction.options.getMember('user'));
      if (problem) return interaction.reply({ embeds: [problem], flags: MessageFlags.Ephemeral });
      const reason = interaction.options.getString('reason');
      const id = db.addWarning(g, user.id, interaction.user.id, reason);
      const count = db.listWarnings(g, user.id).length;
      await user.send({ embeds: [embeds.warn(`You were warned in **${interaction.guild.name}**.\nReason: ${reason}`)] }).catch(() => {});
      await interaction.reply({ embeds: [embeds.success(`Warned ${user} (warning #${id}). They now have **${count}** warning(s).`)] });
      return modlog(interaction.guild, { action: 'Warn', moderator: interaction.user, target: `${user.tag} (${user.id})`, reason });
    }
    if (sub === 'list') {
      const rows = db.listWarnings(g, user.id);
      if (!rows.length) return interaction.reply({ embeds: [embeds.success(`${user} has no warnings.`)], flags: MessageFlags.Ephemeral });
      const lines = rows.slice(0, 25).map((w) => `\`#${w.id}\` <t:${Math.floor(w.created_at / 1000)}:d> by <@${w.mod_id}> — ${w.reason}`);
      return interaction.reply({ embeds: [embeds.brand(`✦ ${user.tag} — ${rows.length} warning(s)`, lines.join('\n'))], flags: MessageFlags.Ephemeral });
    }
    if (sub === 'remove') {
      const ok = db.removeWarning(g, interaction.options.getInteger('id'));
      return interaction.reply({ embeds: [ok ? embeds.success('Warning removed.') : embeds.error('No warning with that ID.')], flags: MessageFlags.Ephemeral });
    }
    const n = db.clearWarnings(g, user.id);
    await interaction.reply({ embeds: [embeds.success(`Cleared ${n} warning(s) from ${user}.`)] });
    modlog(interaction.guild, { action: 'Warnings cleared', moderator: interaction.user, target: `${user.tag} (${user.id})` });
  },
};
