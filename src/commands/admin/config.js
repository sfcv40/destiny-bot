const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType, ChannelType } = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { parseDuration, formatDuration } = require('../../util/time');

module.exports = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure how Destiny hands out accounts.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('view').setDescription('Show current settings.'))
    .addSubcommand((s) => s.setName('cooldown').setDescription('Time between /generate uses per member.')
      .addStringOption((o) => o.setName('duration').setDescription('e.g. 30m, 2h, 1d, or 0 to disable').setRequired(true)))
    .addSubcommand((s) => s.setName('role').setDescription('Require a role to use /generate (leave empty to allow everyone).')
      .addRoleOption((o) => o.setName('role').setDescription('Required role')))
    .addSubcommand((s) => s.setName('logchannel').setDescription('Where to log generations (leave empty to turn off).')
      .addChannelOption((o) => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('delivery').setDescription('How accounts are delivered.')
      .addStringOption((o) => o.setName('mode').setDescription('Delivery mode').setRequired(true).addChoices(
        { name: 'DM (falls back to private reply)', value: 'dm' },
        { name: 'Private reply in channel', value: 'ephemeral' },
      )))
    .addSubcommand((s) => s.setName('reuse').setDescription('One-time accounts (off) or allow the same account to be given again (on).')
      .addBooleanOption((o) => o.setName('enabled').setDescription('Allow reuse').setRequired(true)))
    .addSubcommand((s) => s.setName('resetcooldown').setDescription('Clear a member\'s /generate cooldown.')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId } = interaction;
    const reply = (embed) => interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    switch (sub) {
      case 'view': {
        const s = db.getSettings(guildId);
        return reply(embeds.brand('✦ Destiny settings').addFields(
          { name: 'Cooldown', value: formatDuration(s.cooldown_seconds), inline: true },
          { name: 'Required role', value: s.required_role_id ? `<@&${s.required_role_id}>` : 'Everyone', inline: true },
          { name: 'Log channel', value: s.log_channel_id ? `<#${s.log_channel_id}>` : 'Off', inline: true },
          { name: 'Delivery', value: s.delivery === 'dm' ? 'DM' : 'Private reply', inline: true },
          { name: 'Accounts', value: s.reuse ? 'Reusable' : 'One-time', inline: true },
        ));
      }
      case 'cooldown': {
        const secs = parseDuration(interaction.options.getString('duration'));
        if (secs === null || secs > 30 * 86400) return reply(embeds.error('Use a duration like `30m`, `2h`, `1d` (max 30d), or `0`.'));
        db.updateSetting(guildId, 'cooldown_seconds', secs);
        return reply(embeds.success(`Cooldown set to **${formatDuration(secs)}**.`));
      }
      case 'role': {
        const role = interaction.options.getRole('role');
        db.updateSetting(guildId, 'required_role_id', role?.id ?? null);
        return reply(embeds.success(role ? `Only members with ${role} can use /generate.` : 'Everyone can use /generate.'));
      }
      case 'logchannel': {
        const channel = interaction.options.getChannel('channel');
        db.updateSetting(guildId, 'log_channel_id', channel?.id ?? null);
        return reply(embeds.success(channel ? `Logging generations to ${channel}.` : 'Logging turned off.'));
      }
      case 'delivery': {
        const mode = interaction.options.getString('mode');
        db.updateSetting(guildId, 'delivery', mode);
        return reply(embeds.success(`Accounts will be delivered by **${mode === 'dm' ? 'DM' : 'private reply'}**.`));
      }
      case 'reuse': {
        const enabled = interaction.options.getBoolean('enabled');
        db.updateSetting(guildId, 'reuse', enabled ? 1 : 0);
        return reply(embeds.success(enabled
          ? 'Accounts can now be handed out more than once.'
          : 'Each account is now handed out only once.'));
      }
      case 'resetcooldown': {
        const user = interaction.options.getUser('user');
        db.resetCooldown(guildId, user.id);
        return reply(embeds.success(`Cooldown cleared for ${user}.`));
      }
    }
  },
};
