const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags, ChannelType } = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { checkRole } = require('../../util/authority');

module.exports = {
  perm: P.ManageGuild,
  data: new SlashCommandBuilder().setName('config').setDescription('Configure Mirage.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageGuild)
    .addSubcommand((s) => s.setName('view').setDescription('Show current settings.'))
    .addSubcommand((s) => s.setName('modlog').setDescription('Where Mirage logs every action (empty to turn off).')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('welcome').setDescription('Welcome new members (empty channel to turn off).')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
      .addStringOption((o) => o.setName('message').setDescription('Use {user}, {server}, {count}. \\n for new line').setMaxLength(1500)))
    .addSubcommand((s) => s.setName('autorole').setDescription('Role given to every new member (empty to turn off).')
      .addRoleOption((o) => o.setName('role').setDescription('Role'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const g = interaction.guildId;
    const reply = (e) => interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });

    if (sub === 'view') {
      const s = db.getSettings(g);
      return reply(embeds.brand('✦ Mirage settings').addFields(
        { name: 'Mod log', value: s.modlog_channel_id ? `<#${s.modlog_channel_id}>` : 'Off', inline: true },
        { name: 'Welcome', value: s.welcome_channel_id ? `<#${s.welcome_channel_id}>` : 'Off', inline: true },
        { name: 'Auto-role', value: s.autorole_id ? `<@&${s.autorole_id}>` : 'Off', inline: true },
        { name: 'Welcome message', value: s.welcome_message || 'Default' },
      ));
    }
    if (sub === 'modlog') {
      const ch = interaction.options.getChannel('channel');
      db.updateSettings(g, { modlog_channel_id: ch?.id ?? null });
      return reply(embeds.success(ch ? `Logging every Mirage action to ${ch}.` : 'Mod log turned off.'));
    }
    if (sub === 'welcome') {
      const ch = interaction.options.getChannel('channel');
      const msg = interaction.options.getString('message');
      db.updateSettings(g, { welcome_channel_id: ch?.id ?? null, ...(msg ? { welcome_message: msg } : {}) });
      return reply(embeds.success(ch ? `Welcoming new members in ${ch}.` : 'Welcome messages turned off.'));
    }
    const role = interaction.options.getRole('role');
    if (role) {
      const problem = checkRole(interaction, role);
      if (problem) return reply(problem);
    }
    db.updateSettings(g, { autorole_id: role?.id ?? null });
    return reply(embeds.success(role ? `New members will get ${role}.` : 'Auto-role turned off.'));
  },
};
