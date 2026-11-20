const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType, AttachmentBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { parseAccounts } = require('../../util/parseAccounts');
const categoryAutocomplete = require('../../util/categoryAutocomplete');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PAGE_SIZE = 20;

const categoryOption = (o) => o.setName('category').setDescription('Stock category (default: default)').setAutocomplete(true);

module.exports = {
  adminOnly: true,
  data: new SlashCommandBuilder()
    .setName('stock')
    .setDescription('Manage the usernames and keys Destiny hands out.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('add').setDescription('Add a single username and key.')
      .addStringOption((o) => o.setName('username').setDescription('Username').setRequired(true).setMaxLength(200))
      .addStringOption((o) => o.setName('key').setDescription('Key / password').setRequired(true).setMaxLength(500))
      .addStringOption(categoryOption))
    .addSubcommand((s) => s.setName('upload').setDescription('Bulk add from a .txt file, one "username:key" per line.')
      .addAttachmentOption((o) => o.setName('file').setDescription('Text file of username:key lines').setRequired(true))
      .addStringOption(categoryOption))
    .addSubcommand((s) => s.setName('paste').setDescription('Bulk add by pasting lines into a form.')
      .addStringOption(categoryOption))
    .addSubcommand((s) => s.setName('view').setDescription('Show how much stock is left in each category.'))
    .addSubcommand((s) => s.setName('list').setDescription('List accounts in a category (only you can see it).')
      .addStringOption(categoryOption)
      .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1))
      .addBooleanOption((o) => o.setName('include_claimed').setDescription('Also show already-given accounts')))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove one account by its ID (see /stock list).')
      .addIntegerOption((o) => o.setName('id').setDescription('Account ID').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('clear').setDescription('Delete accounts in a category.')
      .addStringOption(categoryOption)
      .addBooleanOption((o) => o.setName('only_claimed').setDescription('Only delete accounts that were already given out')))
    .addSubcommand((s) => s.setName('restock').setDescription('Put every given-out account in a category back into stock.')
      .addStringOption(categoryOption))
    .addSubcommand((s) => s.setName('export').setDescription('Download a category as a .txt file.')
      .addStringOption(categoryOption)
      .addBooleanOption((o) => o.setName('include_claimed').setDescription('Include already-given accounts')))
    .addSubcommand((s) => s.setName('history').setDescription('See who generated accounts recently.')
      .addUserOption((o) => o.setName('user').setDescription('Filter by user'))),

  autocomplete: categoryAutocomplete,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId } = interaction;
    const category = db.normCategory(interaction.options.getString('category'));
    const reply = (payload) => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });

    switch (sub) {
      case 'add': {
        const username = interaction.options.getString('username').trim();
        const key = interaction.options.getString('key').trim();
        const { added } = db.addAccounts(guildId, category, [{ username, key }], interaction.user.id);
        return reply({
          embeds: [added
            ? embeds.success(`Added **${username}** to **${category}**. ${db.countAccounts(guildId, category)} available.`)
            : embeds.warn('That username and key is already in this category.')],
        });
      }

      case 'upload': {
        const file = interaction.options.getAttachment('file');
        if (file.size > MAX_FILE_BYTES) return reply({ embeds: [embeds.error('File is too large (max 5 MB).')] });
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let text;
        try {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          text = await res.text();
        } catch (err) {
          return interaction.editReply({ embeds: [embeds.error(`Couldn't download that file: ${err.message}`)] });
        }
        return interaction.editReply({ embeds: [importResult(guildId, category, text, interaction.user.id)] });
      }

      case 'paste': {
        const modal = new ModalBuilder()
          .setCustomId(`stock-paste:${category}`)
          .setTitle(`Add accounts to "${category}"`.slice(0, 45))
          .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('lines')
              .setLabel('One username:key per line')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('user1:KEY-AAAA\nuser2:KEY-BBBB')
              .setRequired(true)
              .setMaxLength(4000),
          ));
        return interaction.showModal(modal);
      }

      case 'view': {
        const rows = db.stockSummary(guildId);
        if (!rows.length) return reply({ embeds: [embeds.warn('No stock yet. Add some with `/stock add` or `/stock upload`.')] });
        const settings = db.getSettings(guildId);
        const e = embeds.brand('✦ Stock')
          .setDescription(rows.map((r) =>
            settings.reuse
              ? `**${r.category}** — ${r.total} accounts (reuse on)`
              : `**${r.category}** — ${r.available} available / ${r.total} total`).join('\n'));
        return reply({ embeds: [e] });
      }

      case 'list': {
        const includeClaimed = interaction.options.getBoolean('include_claimed') ?? false;
        const total = db.countAccounts(guildId, category, includeClaimed);
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const page = Math.min(interaction.options.getInteger('page') ?? 1, pages);
        const rows = db.listAccounts(guildId, category, { includeClaimed, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
        if (!rows.length) return reply({ embeds: [embeds.warn(`Nothing in **${category}**.`)] });
        const lines = rows.map((a) =>
          `\`#${a.id}\` ${a.username} : ||${a.key}||${a.claimed_by ? ` — given to <@${a.claimed_by}>` : ''}`);
        return reply({
          embeds: [embeds.brand(`✦ ${category} — page ${page}/${pages}`, lines.join('\n').slice(0, 4000))
            .setFooter({ text: `${total} account(s) · ✦ Destiny` })],
        });
      }

      case 'remove': {
        const removed = db.removeAccount(guildId, interaction.options.getInteger('id'));
        return reply({ embeds: [removed ? embeds.success('Account removed.') : embeds.error('No account with that ID here.')] });
      }

      case 'clear': {
        const onlyClaimed = interaction.options.getBoolean('only_claimed') ?? false;
        const n = db.clearAccounts(guildId, category, onlyClaimed);
        return reply({ embeds: [embeds.success(`Deleted ${n} ${onlyClaimed ? 'given-out ' : ''}account(s) from **${category}**.`)] });
      }

      case 'restock': {
        const n = db.restockClaimed(guildId, category);
        return reply({ embeds: [embeds.success(`Put ${n} account(s) back into **${category}**.`)] });
      }

      case 'export': {
        const includeClaimed = interaction.options.getBoolean('include_claimed') ?? false;
        const rows = db.exportAccounts(guildId, category, includeClaimed);
        if (!rows.length) return reply({ embeds: [embeds.warn(`Nothing in **${category}** to export.`)] });
        const file = new AttachmentBuilder(Buffer.from(rows.map((a) => `${a.username}:${a.key}`).join('\n') + '\n'), {
          name: `destiny-${category}.txt`,
        });
        return reply({ content: `Exported ${rows.length} account(s).`, files: [file] });
      }

      case 'history': {
        const target = interaction.options.getUser('user');
        const rows = db.recentClaims(guildId, { userId: target?.id ?? null });
        if (!rows.length) return reply({ embeds: [embeds.warn('No accounts have been generated yet.')] });
        const lines = rows.map((r) =>
          `<t:${Math.floor(r.claimed_at / 1000)}:R> <@${r.user_id}> — ${r.category ?? 'deleted'} / ${r.username ?? 'deleted'}`);
        return reply({ embeds: [embeds.brand('✦ Recent generations', lines.join('\n'))] });
      }
    }
  },

  async modal(interaction) {
    const category = db.normCategory(interaction.customId.split(':').slice(1).join(':'));
    const text = interaction.fields.getTextInputValue('lines');
    await interaction.reply({ embeds: [importResult(interaction.guildId, category, text, interaction.user.id)], flags: MessageFlags.Ephemeral });
  },
};

function importResult(guildId, category, text, userId) {
  const { entries, invalid } = parseAccounts(text);
  if (!entries.length) return embeds.error('No valid lines found. Use one `username:key` per line.');
  const { added, duplicates } = db.addAccounts(guildId, category, entries, userId);
  let desc = `Added **${added}** account(s) to **${category}**.`;
  if (duplicates) desc += `\nSkipped ${duplicates} duplicate(s).`;
  if (invalid.length) desc += `\nSkipped ${invalid.length} invalid line(s).`;
  desc += `\n${db.countAccounts(guildId, category)} now available.`;
  return embeds.success(desc);
}
