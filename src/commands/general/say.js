const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const embeds = require('../../util/embeds');

// Modal state is passed through the custom ID: say-modal:<channelId>:<embed 0|1>
const MODAL_PREFIX = 'say-modal';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as Destiny. Leave "message" empty to write a multi-line one.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) => o.setName('message').setDescription('What Destiny should say (use \\n for a new line)').setMaxLength(2000))
    .addChannelOption((o) => o.setName('channel').setDescription('Where to send it (default: here)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addBooleanOption((o) => o.setName('embed').setDescription('Send it as a styled Destiny embed'))
    .addStringOption((o) => o.setName('title').setDescription('Embed title (only with embed)').setMaxLength(256)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const asEmbed = interaction.options.getBoolean('embed') ?? false;
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');

    if (!message) {
      const modal = new ModalBuilder()
        .setCustomId(`${MODAL_PREFIX}:${channel.id}:${asEmbed ? 1 : 0}`)
        .setTitle('Send a message as Destiny');
      if (asEmbed) {
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Title (optional)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(title ?? ''),
        ));
      }
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('message').setLabel('Message')
          .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(asEmbed ? 4000 : 2000),
      ));
      return interaction.showModal(modal);
    }

    return send(interaction, channel, message.replace(/\\n/g, '\n'), asEmbed, title);
  },

  async modal(interaction) {
    const [, channelId, embedFlag] = interaction.customId.split(':');
    const channel = interaction.guild.channels.cache.get(channelId);
    const asEmbed = embedFlag === '1';
    const title = asEmbed ? interaction.fields.getTextInputValue('title') || null : null;
    return send(interaction, channel, interaction.fields.getTextInputValue('message'), asEmbed, title);
  },
};

async function send(interaction, channel, text, asEmbed, title) {
  const fail = (msg) => interaction.reply({ embeds: [embeds.error(msg)], flags: MessageFlags.Ephemeral });
  if (!channel?.isTextBased()) return fail('I can\'t find that channel.');

  // Make sure the person sending is allowed to post there and the bot can too.
  const mine = channel.permissionsFor(interaction.guild.members.me);
  const theirs = channel.permissionsFor(interaction.member);
  if (!theirs?.has(PermissionFlagsBits.SendMessages)) return fail(`You can't send messages in ${channel}.`);
  if (!mine?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    return fail(`I need View Channel, Send Messages and Embed Links in ${channel}.`);
  }

  // Only let people ping @everyone / roles through Destiny if they could do it themselves.
  const canMentionAll = theirs.has(PermissionFlagsBits.MentionEveryone);
  const allowedMentions = canMentionAll ? { parse: ['users', 'roles', 'everyone'] } : { parse: ['users'] };

  const payload = asEmbed
    ? { embeds: [embeds.brand(title, text.slice(0, 4096)).setFooter(null).setTimestamp(null)], allowedMentions }
    : { content: text.slice(0, 2000), allowedMentions };

  await channel.send(payload);
  return interaction.reply({ embeds: [embeds.success(`Sent in ${channel}.`)], flags: MessageFlags.Ephemeral });
}
