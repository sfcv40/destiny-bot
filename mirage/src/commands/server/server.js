const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags, GuildVerificationLevel } = require('discord.js');
const embeds = require('../../util/embeds');
const { modlog } = require('../../util/modlog');
const { isOwner } = require('../../util/authority');

const MAX_IMAGE = 8 * 1024 * 1024;

module.exports = {
  perm: P.ManageGuild,
  data: new SlashCommandBuilder().setName('server').setDescription('Manage the server itself.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageGuild)
    .addSubcommand((s) => s.setName('info').setDescription('Server stats.'))
    .addSubcommand((s) => s.setName('check').setDescription('Check Mirage has the power it needs.'))
    .addSubcommand((s) => s.setName('name').setDescription('Rename the server.')
      .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMinLength(2).setMaxLength(100)))
    .addSubcommand((s) => s.setName('icon').setDescription('Change the server icon.')
      .addAttachmentOption((o) => o.setName('image').setDescription('PNG/JPG/GIF').setRequired(true)))
    .addSubcommand((s) => s.setName('verification').setDescription('Set the verification level.')
      .addStringOption((o) => o.setName('level').setDescription('Level').setRequired(true).addChoices(
        { name: 'None', value: 'None' }, { name: 'Low (verified email)', value: 'Low' },
        { name: 'Medium (5 min on Discord)', value: 'Medium' }, { name: 'High (10 min in server)', value: 'High' },
        { name: 'Highest (verified phone)', value: 'VeryHigh' }))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild, user: mod } = interaction;

    if (sub === 'info') {
      const owner = await guild.fetchOwner().catch(() => null);
      const e = embeds.brand(guild.name).setThumbnail(guild.iconURL()).addFields(
        { name: 'Owner', value: owner ? `${owner.user}` : 'Unknown', inline: true },
        { name: 'Members', value: String(guild.memberCount), inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
        { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
        { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`, inline: true },
      );
      return interaction.reply({ embeds: [e] });
    }

    if (sub === 'check') {
      const me = guild.members.me;
      const roles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
      const above = roles.filter((r) => r.position > me.roles.highest.position);
      const ownerIds = (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
      const intentOk = interaction.client.options.intents.has('GuildMembers');
      const lines = [
        `${me.permissions.has(P.Administrator) ? '✅' : '❌'} **Administrator** permission${me.permissions.has(P.Administrator) ? '' : ': re-invite with the link in the README'}`,
        `${above.length === 0 ? '✅ Mirage\'s role is at the **top** of the role list' : `❌ ${above.length} role(s) are above Mirage: ${above.slice(0, 5).map(String).join(' ')}. Drag **${me.roles.highest.name}** to the top in Server Settings → Roles`}`,
        `${ownerIds.length ? '✅' : '⚠️'} Owners: ${[guild.ownerId, ...ownerIds].filter((v, i, a) => a.indexOf(v) === i).map((id) => `<@${id}>`).join(', ')}${ownerIds.length ? '' : ' (set OWNER_IDS to add yourself if you don\'t own the server)'}`,
        `${intentOk ? '✅' : '⚠️'} **Server Members Intent**${intentOk ? '' : ' is off: welcome messages, auto-role and `/role all` won\'t work. Turn it on in the Developer Portal → Bot, then restart'}`,
      ];
      return interaction.reply({ embeds: [embeds.brand('✦ Mirage power check', lines.join('\n\n'))], flags: MessageFlags.Ephemeral });
    }

    if (!interaction.memberPermissions.has(P.Administrator) && !isOwner(mod.id, guild)) {
      return interaction.reply({ embeds: [embeds.error('Changing the server needs **Administrator**.')], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'name') {
      const old = guild.name;
      await guild.setName(interaction.options.getString('name'), `By ${mod.tag}`);
      await interaction.reply({ embeds: [embeds.success(`Server renamed from **${old}** to **${guild.name}**.`)] });
      return modlog(guild, { action: 'Server renamed', moderator: mod, target: `${old} → ${guild.name}` });
    }

    if (sub === 'icon') {
      const img = interaction.options.getAttachment('image');
      if (!img.contentType?.startsWith('image/') || img.size > MAX_IMAGE) {
        return interaction.reply({ embeds: [embeds.error('Send a PNG, JPG or GIF under 8 MB.')], flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply();
      await guild.setIcon(img.url, `By ${mod.tag}`);
      await interaction.editReply({ embeds: [embeds.success('Server icon updated.').setThumbnail(guild.iconURL())] });
      return modlog(guild, { action: 'Server icon changed', moderator: mod });
    }

    if (sub === 'verification') {
      const level = interaction.options.getString('level');
      await guild.setVerificationLevel(GuildVerificationLevel[level], `By ${mod.tag}`);
      await interaction.reply({ embeds: [embeds.success(`Verification level set to **${level}**.`)] });
      return modlog(guild, { action: 'Verification level changed', moderator: mod, target: level });
    }
  },
};
