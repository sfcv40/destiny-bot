const {
  SlashCommandBuilder, PermissionFlagsBits: P, MessageFlags, InteractionContextType, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  perm: P.ManageMessages,
  data: new SlashCommandBuilder().setName('say')
    .setDescription('Send a message as Mirage. Leave "message" empty to write a multi-line one.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageMessages)
    .addStringOption((o) => o.setName('message').setDescription('What to say (use \\n for a new line)').setMaxLength(2000))
    .addChannelOption((o) => o.setName('channel').setDescription('Where (default: here)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addBooleanOption((o) => o.setName('embed').setDescription('Send as a styled embed'))
    .addStringOption((o) => o.setName('title').setDescription('Embed title').setMaxLength(256)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const asEmbed = interaction.options.getBoolean('embed') ?? false;
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    if (message) return send(interaction, channel, message.replace(/\\n/g, '\n'), asEmbed, title);

    const modal = new ModalBuilder().setCustomId(`say-modal:${channel.id}:${asEmbed ? 1 : 0}`).setTitle('Send a message as Mirage');
    if (asEmbed) {
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title')
        .setLabel('Title (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256).setValue(title ?? '')));
    }
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message')
      .setLabel('Message').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(asEmbed ? 4000 : 2000)));
    return interaction.showModal(modal);
  },

  async modal(interaction) {
    const [, channelId, flag] = interaction.customId.split(':');
    const asEmbed = flag === '1';
    return send(interaction, interaction.guild.channels.cache.get(channelId),
      interaction.fields.getTextInputValue('message'), asEmbed,
      asEmbed ? interaction.fields.getTextInputValue('title') || null : null);
  },
};

async function send(interaction, channel, text, asEmbed, title) {
  if (!channel?.isTextBased()) return interaction.reply({ embeds: [embeds.error('I can\'t find that channel.')], flags: MessageFlags.Ephemeral });
  const canPingAll = channel.permissionsFor(interaction.member)?.has(P.MentionEveryone);
  const allowedMentions = { parse: canPingAll ? ['users', 'roles', 'everyone'] : ['users'] };
  await channel.send(asEmbed
    ? { embeds: [embeds.brand(title, text.slice(0, 4096)).setFooter(null).setTimestamp(null)], allowedMentions }
    : { content: text.slice(0, 2000), allowedMentions });
  return interaction.reply({ embeds: [embeds.success(`Sent in ${channel}.`)], flags: MessageFlags.Ephemeral });
}
