const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags, ChannelType } = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { modlog } = require('../../util/modlog');
const { isOwner } = require('../../util/authority');

const LOCKABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice];

module.exports = {
  perm: P.ManageChannels,
  data: new SlashCommandBuilder().setName('lock').setDescription('Lock channels so members can\'t talk.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageChannels)
    .addSubcommand((s) => s.setName('channel').setDescription('Lock one channel.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(...LOCKABLE))
      .addStringOption((o) => o.setName('reason').setDescription('Reason')))
    .addSubcommand((s) => s.setName('unlock').setDescription('Unlock one channel.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(...LOCKABLE)))
    .addSubcommand((s) => s.setName('server').setDescription('LOCKDOWN: lock every channel in the server.')
      .addStringOption((o) => o.setName('reason').setDescription('Reason')))
    .addSubcommand((s) => s.setName('endlockdown').setDescription('End a server lockdown.')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;
    const everyone = guild.roles.everyone;
    const reason = interaction.options.getString('reason');
    const deny = { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, AddReactions: false, Speak: false };
    const reset = { SendMessages: null, SendMessagesInThreads: null, CreatePublicThreads: null, AddReactions: null, Speak: null };

    if (sub === 'channel' || sub === 'unlock') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      await channel.permissionOverwrites.edit(everyone, sub === 'channel' ? deny : reset, { reason: `By ${interaction.user.tag}` });
      await interaction.reply({ embeds: [embeds.success(sub === 'channel' ? `🔒 Locked ${channel}.${reason ? ` Reason: ${reason}` : ''}` : `🔓 Unlocked ${channel}.`)] });
      return modlog(guild, { action: sub === 'channel' ? 'Channel locked' : 'Channel unlocked', moderator: interaction.user, target: channel, reason });
    }

    if (!interaction.memberPermissions.has(P.Administrator) && !isOwner(interaction.user.id, guild)) {
      return interaction.reply({ embeds: [embeds.error('Server lockdowns need **Administrator**.')], flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply();

    if (sub === 'server') {
      let n = 0;
      for (const channel of guild.channels.cache.values()) {
        if (!LOCKABLE.includes(channel.type)) continue;
        // Skip channels members already can't see or talk in, so ending the lockdown doesn't open them up.
        const perms = channel.permissionsFor(everyone);
        const talk = channel.type === ChannelType.GuildVoice ? P.Speak : P.SendMessages;
        if (!perms.has(P.ViewChannel) || !perms.has(talk)) continue;
        await channel.permissionOverwrites.edit(everyone, deny, { reason: `Lockdown by ${interaction.user.tag}` }).then(() => {
          db.addLockdownChannel(guild.id, channel.id); n++;
        }).catch(() => {});
      }
      await interaction.editReply({ embeds: [embeds.brand('🔒 Server lockdown', `Locked **${n}** channel(s).${reason ? `\nReason: ${reason}` : ''}\nEnd it with \`/lock endlockdown\`.`)] });
      return modlog(guild, { action: 'SERVER LOCKDOWN', moderator: interaction.user, reason, extra: [{ name: 'Channels', value: String(n), inline: true }] });
    }

    let n = 0;
    for (const id of db.getLockdownChannels(guild.id)) {
      const channel = guild.channels.cache.get(id);
      if (channel) await channel.permissionOverwrites.edit(everyone, reset, { reason: `Lockdown ended by ${interaction.user.tag}` }).then(() => n++).catch(() => {});
    }
    db.clearLockdown(guild.id);
    await interaction.editReply({ embeds: [embeds.success(`🔓 Lockdown ended. Unlocked ${n} channel(s).`)] });
    modlog(guild, { action: 'Lockdown ended', moderator: interaction.user });
  },
};
