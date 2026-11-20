const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType, ChannelType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder,
} = require('discord.js');
const tickets = require('../../ticketsDb');
const embeds = require('../../util/embeds');
const { isAdmin } = require('../../util/permissions');

const P = PermissionFlagsBits;
const MEMBER_PERMS = [P.ViewChannel, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.ReadMessageHistory];
const CLOSE_DELAY_MS = 5000;
const MAX_TRANSCRIPT_MESSAGES = 2000;

// Users currently having a ticket created, to stop double-clicks making two channels.
const opening = new Set();

const ephemeral = (interaction, embed) => {
  const payload = { embeds: [embed], flags: MessageFlags.Ephemeral };
  return interaction.deferred || interaction.replied ? interaction.followUp(payload) : interaction.reply(payload);
};

function isStaff(interaction) {
  if (isAdmin(interaction)) return true;
  const { support_role_id: roleId } = tickets.getTicketSettings(interaction.guildId);
  return Boolean(
    (roleId && interaction.member.roles.cache.has(roleId)) ||
    interaction.memberPermissions?.has(P.ManageChannels),
  );
}

const ticketButtons = (claimed = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ticket-claim').setLabel(claimed ? 'Claimed' : 'Claim')
    .setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(claimed),
  new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Support tickets.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('setup').setDescription('Configure tickets (admin).')
      .addRoleOption((o) => o.setName('support_role').setDescription('Role that can see and handle tickets'))
      .addChannelOption((o) => o.setName('category').setDescription('Category to create ticket channels in')
        .addChannelTypes(ChannelType.GuildCategory))
      .addChannelOption((o) => o.setName('log_channel').setDescription('Where closed-ticket transcripts are sent')
        .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('panel').setDescription('Post the "Open a ticket" panel (admin).')
      .addChannelOption((o) => o.setName('channel').setDescription('Where to post it (default: here)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption((o) => o.setName('title').setDescription('Panel title').setMaxLength(256))
      .addStringOption((o) => o.setName('message').setDescription('Panel text (use \\n for a new line)').setMaxLength(2000)))
    .addSubcommand((s) => s.setName('settings').setDescription('Show ticket settings (admin).'))
    .addSubcommand((s) => s.setName('close').setDescription('Close this ticket.')
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(500)))
    .addSubcommand((s) => s.setName('claim').setDescription('Claim this ticket (staff).'))
    .addSubcommand((s) => s.setName('add').setDescription('Add someone to this ticket (staff).')
      .addUserOption((o) => o.setName('user').setDescription('Member to add').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove someone from this ticket (staff).')
      .addUserOption((o) => o.setName('user').setDescription('Member to remove').setRequired(true)))
    .addSubcommand((s) => s.setName('rename').setDescription('Rename this ticket channel (staff).')
      .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true).setMaxLength(90))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId } = interaction;

    if (['setup', 'panel', 'settings'].includes(sub) && !isAdmin(interaction)) {
      return ephemeral(interaction, embeds.error('You need **Manage Server** to use this.'));
    }

    switch (sub) {
      case 'setup': {
        const role = interaction.options.getRole('support_role');
        const category = interaction.options.getChannel('category');
        const log = interaction.options.getChannel('log_channel');
        const changes = {};
        if (role) changes.support_role_id = role.id;
        if (category) changes.category_id = category.id;
        if (log) changes.log_channel_id = log.id;
        if (!Object.keys(changes).length) {
          return ephemeral(interaction, embeds.warn('Pick at least one option: `support_role`, `category` or `log_channel`.'));
        }
        tickets.updateTicketSettings(guildId, changes);
        return ephemeral(interaction, settingsEmbed(guildId).setTitle('✦ Ticket settings saved')
          .setDescription('Next, post the panel with `/ticket panel`.'));
      }

      case 'settings':
        return ephemeral(interaction, settingsEmbed(guildId));

      case 'panel': {
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        const title = interaction.options.getString('title') ?? '✦ Need help?';
        const text = (interaction.options.getString('message') ??
          'Press the button below to open a private support ticket.\nOnly you and our staff will be able to see it.')
          .replace(/\\n/g, '\n');
        const me = channel.permissionsFor(interaction.guild.members.me);
        if (!me?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
          return ephemeral(interaction, embeds.error(`I need View Channel, Send Messages and Embed Links in ${channel}.`));
        }
        await channel.send({
          embeds: [embeds.brand(title, text).setTimestamp(null)],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket-open').setLabel('Open a ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
          )],
        });
        const s = tickets.getTicketSettings(guildId);
        const tip = s.support_role_id ? '' : '\nTip: set a support role with `/ticket setup` so staff can see tickets.';
        return ephemeral(interaction, embeds.success(`Ticket panel posted in ${channel}.${tip}`));
      }
    }

    // Everything below happens inside a ticket channel.
    const ticket = tickets.getTicketByChannel(interaction.channelId);
    if (!ticket || ticket.status !== 'open') {
      return ephemeral(interaction, embeds.error('This isn\'t an open ticket channel.'));
    }

    if (sub === 'close') {
      if (!isStaff(interaction) && interaction.user.id !== ticket.user_id) {
        return ephemeral(interaction, embeds.error('Only staff or the person who opened this ticket can close it.'));
      }
      return closeTicketFlow(interaction, ticket, interaction.options.getString('reason'));
    }

    if (!isStaff(interaction)) return ephemeral(interaction, embeds.error('Only support staff can do that.'));

    switch (sub) {
      case 'claim':
        return claimFlow(interaction, ticket);

      case 'add': {
        const user = interaction.options.getUser('user');
        await interaction.channel.permissionOverwrites.edit(user.id, Object.fromEntries(MEMBER_PERMS.map((p) => [permName(p), true])));
        return interaction.reply({ embeds: [embeds.success(`${user} was added to the ticket.`)] });
      }

      case 'remove': {
        const user = interaction.options.getUser('user');
        if (user.id === ticket.user_id) return ephemeral(interaction, embeds.error('You can\'t remove the person who opened the ticket. Close it instead.'));
        await interaction.channel.permissionOverwrites.delete(user.id);
        return interaction.reply({ embeds: [embeds.success(`${user} was removed from the ticket.`)] });
      }

      case 'rename': {
        const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'ticket';
        await interaction.channel.setName(name);
        return ephemeral(interaction, embeds.success(`Renamed to **${name}**.`));
      }
    }
  },

  async button(interaction) {
    const action = interaction.customId.slice('ticket-'.length);

    if (action === 'open') {
      const existing = tickets.getOpenTicketForUser(interaction.guildId, interaction.user.id);
      if (existing && interaction.guild.channels.cache.has(existing.channel_id)) {
        return ephemeral(interaction, embeds.warn(`You already have an open ticket: <#${existing.channel_id}>`));
      }
      if (existing) tickets.closeTicket(existing.channel_id, interaction.client.user.id, 'Channel was deleted');

      const modal = new ModalBuilder().setCustomId('ticket-openmodal').setTitle('Open a support ticket')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('How can we help?')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000),
        ));
      return interaction.showModal(modal);
    }

    const ticket = tickets.getTicketByChannel(interaction.channelId);
    if (!ticket || ticket.status !== 'open') return ephemeral(interaction, embeds.error('This ticket is already closed.'));

    if (action === 'claim') {
      if (!isStaff(interaction)) return ephemeral(interaction, embeds.error('Only support staff can claim tickets.'));
      return claimFlow(interaction, ticket);
    }

    if (action === 'close') {
      if (!isStaff(interaction) && interaction.user.id !== ticket.user_id) {
        return ephemeral(interaction, embeds.error('Only staff or the person who opened this ticket can close it.'));
      }
      const modal = new ModalBuilder().setCustomId('ticket-closemodal').setTitle('Close ticket')
        .addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel('Reason (optional)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(500),
        ));
      return interaction.showModal(modal);
    }
  },

  async modal(interaction) {
    if (interaction.customId === 'ticket-openmodal') {
      return openTicketFlow(interaction, interaction.fields.getTextInputValue('reason'));
    }
    if (interaction.customId === 'ticket-closemodal') {
      const ticket = tickets.getTicketByChannel(interaction.channelId);
      if (!ticket || ticket.status !== 'open') return ephemeral(interaction, embeds.error('This ticket is already closed.'));
      return closeTicketFlow(interaction, ticket, interaction.fields.getTextInputValue('reason') || null);
    }
  },
};

// ---------- flows ----------

async function openTicketFlow(interaction, reason) {
  const { guild, user } = interaction;
  if (opening.has(user.id)) return ephemeral(interaction, embeds.warn('Your ticket is already being created…'));
  opening.add(user.id);
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const existing = tickets.getOpenTicketForUser(guild.id, user.id);
    if (existing && guild.channels.cache.has(existing.channel_id)) {
      return interaction.editReply({ embeds: [embeds.warn(`You already have an open ticket: <#${existing.channel_id}>`)] });
    }

    const settings = tickets.getTicketSettings(guild.id);
    const me = guild.members.me;
    if (!me.permissions.has([P.ManageChannels, P.ManageRoles])) {
      return interaction.editReply({ embeds: [embeds.error('I need the **Manage Channels** and **Manage Roles** permissions to create tickets. Ask an admin to fix my role.')] });
    }

    const parent = settings.category_id && guild.channels.cache.get(settings.category_id)?.type === ChannelType.GuildCategory
      ? settings.category_id : null;
    const number = tickets.nextTicketNumber(guild.id);
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: user.id, allow: MEMBER_PERMS },
      { id: me.id, allow: [...MEMBER_PERMS, P.ManageChannels, P.ManageMessages] },
    ];
    if (settings.support_role_id && guild.roles.cache.has(settings.support_role_id)) {
      overwrites.push({ id: settings.support_role_id, allow: [...MEMBER_PERMS, P.ManageMessages] });
    }

    const channel = await guild.channels.create({
      name: `ticket-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent,
      topic: `Support ticket #${number} for ${user.tag} (${user.id})`,
      permissionOverwrites: overwrites,
      reason: `Ticket #${number} opened by ${user.tag}`,
    });
    tickets.createTicket({ guildId: guild.id, channelId: channel.id, userId: user.id, number, reason });

    const ping = [`${user}`, settings.support_role_id ? `<@&${settings.support_role_id}>` : null].filter(Boolean).join(' ');
    await channel.send({
      content: ping,
      allowedMentions: { users: [user.id], roles: settings.support_role_id ? [settings.support_role_id] : [] },
      embeds: [embeds.brand(`🎫 Ticket #${number}`,
        `Thanks for reaching out, ${user}. Our team will be with you soon.\nPress **Close** when you're done.`)
        .addFields({ name: 'Reason', value: reason.slice(0, 1024) })],
      components: [ticketButtons()],
    });

    return interaction.editReply({ embeds: [embeds.success(`Your ticket is ready: ${channel}`)] });
  } finally {
    opening.delete(user.id);
  }
}

async function claimFlow(interaction, ticket) {
  if (ticket.claimed_by) {
    return ephemeral(interaction, embeds.warn(`This ticket is already claimed by <@${ticket.claimed_by}>.`));
  }
  tickets.claimTicket(ticket.channel_id, interaction.user.id);
  if (interaction.isButton()) await interaction.message.edit({ components: [ticketButtons(true)] }).catch(() => {});
  return interaction.reply({ embeds: [embeds.brand(null, `✋ ${interaction.user} is handling this ticket.`).setFooter(null).setTimestamp(null)] });
}

async function closeTicketFlow(interaction, ticket, reason) {
  if (!tickets.closeTicket(ticket.channel_id, interaction.user.id, reason)) {
    return ephemeral(interaction, embeds.error('This ticket is already closed.'));
  }
  await interaction.reply({
    embeds: [embeds.warn(`🔒 Ticket closed by ${interaction.user}. This channel will be deleted in ${CLOSE_DELAY_MS / 1000} seconds.` +
      (reason ? `\nReason: ${reason}` : ''))],
  });

  const channel = interaction.channel;
  const { file, hiddenContent } = await buildTranscript(channel, ticket).catch((err) => {
    console.warn('Transcript failed:', err.message);
    return { file: null, hiddenContent: false };
  });

  const summary = embeds.brand(`🎫 Ticket #${ticket.number} closed`).addFields(
    { name: 'Opened by', value: `<@${ticket.user_id}>`, inline: true },
    { name: 'Closed by', value: `${interaction.user}`, inline: true },
    { name: 'Claimed by', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Nobody', inline: true },
    { name: 'Opened', value: `<t:${Math.floor(ticket.opened_at / 1000)}:f>`, inline: true },
    { name: 'Reason opened', value: (ticket.reason || 'None').slice(0, 1024) },
    { name: 'Reason closed', value: (reason || 'None').slice(0, 1024) },
  );
  if (hiddenContent) {
    summary.addFields({ name: 'Note', value: 'Message text is missing from the transcript. Turn on **Message Content Intent** in the Developer Portal (Bot page) to include it.' });
  }
  const files = () => (file ? [new AttachmentBuilder(file.data, { name: file.name })] : []);

  const settings = tickets.getTicketSettings(interaction.guildId);
  const log = settings.log_channel_id && interaction.guild.channels.cache.get(settings.log_channel_id);
  if (log?.isTextBased()) await log.send({ embeds: [summary], files: files() }).catch(() => {});

  const opener = await interaction.client.users.fetch(ticket.user_id).catch(() => null);
  await opener?.send({
    content: `Your ticket in **${interaction.guild.name}** was closed. Here's a copy of the conversation.`,
    embeds: [summary],
    files: files(),
  }).catch(() => {});

  setTimeout(() => channel.delete(`Ticket #${ticket.number} closed`).catch(() => {}), CLOSE_DELAY_MS);
}

// ---------- helpers ----------

async function buildTranscript(channel, ticket) {
  const all = [];
  let before;
  while (all.length < MAX_TRANSCRIPT_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  all.reverse();

  const botId = channel.client.user.id;
  let hiddenContent = false;
  const lines = all.map((m) => {
    const time = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
    let text = m.content;
    if (!text && m.author.id !== botId && !m.attachments.size && !m.embeds.length) {
      hiddenContent = true;
      text = '[message text unavailable]';
    }
    const extras = [
      ...m.embeds.map((e) => `[embed] ${[e.title, e.description].filter(Boolean).join(' — ')}`),
      ...m.attachments.map((a) => `[attachment] ${a.url}`),
    ];
    return `[${time} UTC] ${m.author.tag}: ${[text, ...extras].filter(Boolean).join('\n    ')}`;
  });

  const header = [
    `Ticket #${ticket.number} — ${channel.guild.name}`,
    `Opened by user ID ${ticket.user_id} at ${new Date(ticket.opened_at).toISOString()}`,
    `Reason: ${ticket.reason || 'None'}`,
    '-'.repeat(60),
  ];
  return {
    file: { name: `ticket-${String(ticket.number).padStart(4, '0')}.txt`, data: Buffer.from([...header, ...lines].join('\n') + '\n') },
    hiddenContent,
  };
}

function settingsEmbed(guildId) {
  const s = tickets.getTicketSettings(guildId);
  return embeds.brand('✦ Ticket settings').addFields(
    { name: 'Support role', value: s.support_role_id ? `<@&${s.support_role_id}>` : 'Not set (only admins see tickets)', inline: true },
    { name: 'Category', value: s.category_id ? `<#${s.category_id}>` : 'None (top of the channel list)', inline: true },
    { name: 'Transcript log', value: s.log_channel_id ? `<#${s.log_channel_id}>` : 'Off', inline: true },
    { name: 'Tickets opened', value: String(s.counter), inline: true },
  );
}

function permName(bit) {
  return Object.entries(P).find(([, v]) => v === bit)[0];
}
