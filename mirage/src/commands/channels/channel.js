const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags, ChannelType } = require('discord.js');
const embeds = require('../../util/embeds');
const { modlog } = require('../../util/modlog');

const TYPES = {
  text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement, stage: ChannelType.GuildStageVoice, forum: ChannelType.GuildForum,
};

module.exports = {
  perm: P.ManageChannels,
  data: new SlashCommandBuilder().setName('channel').setDescription('Manage channels.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageChannels)
    .addSubcommand((s) => s.setName('create').setDescription('Create a channel.')
      .addStringOption((o) => o.setName('name').setDescription('Name').setRequired(true).setMaxLength(100))
      .addStringOption((o) => o.setName('type').setDescription('Type (default: text)')
        .addChoices(...Object.keys(TYPES).map((k) => ({ name: k, value: k }))))
      .addChannelOption((o) => o.setName('category').setDescription('Put it in this category').addChannelTypes(ChannelType.GuildCategory))
      .addBooleanOption((o) => o.setName('private').setDescription('Hide it from @everyone')))
    .addSubcommand((s) => s.setName('delete').setDescription('Delete a channel.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)')))
    .addSubcommand((s) => s.setName('rename').setDescription('Rename a channel.')
      .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(100))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)')))
    .addSubcommand((s) => s.setName('topic').setDescription('Set a channel\'s topic.')
      .addStringOption((o) => o.setName('topic').setDescription('Topic (leave empty to clear)').setMaxLength(1024))
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((s) => s.setName('clone').setDescription('Clone a channel with the same settings.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)')))
    .addSubcommand((s) => s.setName('nuke').setDescription('Wipe a channel: clone it and delete the original.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('hide').setDescription('Hide a channel from @everyone.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)')))
    .addSubcommand((s) => s.setName('show').setDescription('Make a hidden channel visible to @everyone again.')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: here)'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild, user: mod } = interaction;
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const why = { reason: `By ${mod.tag}` };

    switch (sub) {
      case 'create': {
        const type = TYPES[interaction.options.getString('type') ?? 'text'];
        if (type === ChannelType.GuildAnnouncement && !guild.features.includes('COMMUNITY')) {
          return interaction.reply({ embeds: [embeds.error('Announcement channels need Community enabled on the server.')], flags: MessageFlags.Ephemeral });
        }
        const created = await guild.channels.create({
          name: interaction.options.getString('name'), type,
          parent: type === ChannelType.GuildCategory ? null : interaction.options.getChannel('category')?.id ?? null,
          permissionOverwrites: interaction.options.getBoolean('private')
            ? [{ id: guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: guild.members.me.id, allow: [P.ViewChannel] }] : undefined,
          ...why,
        });
        await interaction.reply({ embeds: [embeds.success(`Created ${created}.`)] });
        return modlog(guild, { action: 'Channel created', moderator: mod, target: created });
      }
      case 'delete': {
        const name = channel.name;
        const here = channel.id === interaction.channelId;
        if (!here) await interaction.reply({ embeds: [embeds.success(`Deleted **#${name}**.`)] });
        else await interaction.reply({ embeds: [embeds.warn('Deleting this channel…')] });
        await channel.delete(why.reason);
        return modlog(guild, { action: 'Channel deleted', moderator: mod, target: `#${name}` });
      }
      case 'rename': {
        await channel.setName(interaction.options.getString('name'), why.reason);
        return interaction.reply({ embeds: [embeds.success(`Renamed to ${channel}.`)] });
      }
      case 'topic': {
        await channel.setTopic(interaction.options.getString('topic'), why.reason);
        return interaction.reply({ embeds: [embeds.success(`Updated the topic of ${channel}.`)] });
      }
      case 'clone': {
        const copy = await channel.clone(why);
        await interaction.reply({ embeds: [embeds.success(`Cloned ${channel} → ${copy}.`)] });
        return modlog(guild, { action: 'Channel cloned', moderator: mod, target: copy });
      }
      case 'nuke': {
        await interaction.reply({ embeds: [embeds.warn(`Nuking ${channel}…`)], flags: MessageFlags.Ephemeral });
        const position = channel.position;
        const copy = await channel.clone(why);
        await copy.setPosition(position);
        await channel.delete(why.reason);
        await copy.send({ embeds: [embeds.brand('💥 Channel nuked', `Wiped by ${mod}.`)] });
        return modlog(guild, { action: 'Channel nuked', moderator: mod, target: copy });
      }
      case 'hide':
      case 'show': {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: sub === 'hide' ? false : null }, why);
        await channel.permissionOverwrites.edit(guild.members.me, { ViewChannel: true }, why);
        return interaction.reply({ embeds: [embeds.success(sub === 'hide' ? `🙈 ${channel} is now hidden from @everyone.` : `👁️ ${channel} is visible again.`)] });
      }
    }
  },
};
