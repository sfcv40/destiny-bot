const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const db = require('../../db');
const embeds = require('../../util/embeds');
const { isAdmin } = require('../../util/permissions');
const categoryAutocomplete = require('../../util/categoryAutocomplete');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generate')
    .setDescription('Get a random username and key from Destiny\'s stock.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o.setName('category').setDescription('Which stock to pull from (default: default)').setAutocomplete(true)),

  autocomplete: categoryAutocomplete,

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { guildId, user } = interaction;
    const settings = db.getSettings(guildId);
    const admin = isAdmin(interaction);
    const category = db.normCategory(interaction.options.getString('category'));

    if (settings.required_role_id && !admin && !interaction.member.roles.cache.has(settings.required_role_id)) {
      return interaction.editReply({ embeds: [embeds.error(`You need the <@&${settings.required_role_id}> role to use this.`)] });
    }

    if (!admin && settings.cooldown_seconds > 0) {
      const last = db.lastClaim(guildId, user.id);
      const readyAt = last ? last + settings.cooldown_seconds * 1000 : 0;
      if (readyAt > Date.now()) {
        return interaction.editReply({
          embeds: [embeds.warn(`You're on cooldown. Try again <t:${Math.ceil(readyAt / 1000)}:R>.`)],
        });
      }
    }

    const account = db.claimRandom(guildId, category, user.id, Boolean(settings.reuse));
    if (!account) {
      return interaction.editReply({ embeds: [embeds.error(`**${category}** is out of stock. Ask an admin to restock.`)] });
    }

    const remaining = settings.reuse ? null : db.countAccounts(guildId, category);
    const accountEmbed = embeds.brand('✦ Your destiny has been revealed')
      .addFields(
        { name: 'Username', value: '```' + account.username + '```' },
        { name: 'Key', value: '```' + account.key + '```' },
        { name: 'Category', value: category, inline: true },
        { name: 'Server', value: interaction.guild.name, inline: true },
      );

    let where = 'below';
    if (settings.delivery === 'dm') {
      try {
        await user.send({ embeds: [accountEmbed] });
        where = 'dm';
      } catch {
        where = 'fallback';
      }
    }

    if (where === 'dm') {
      await interaction.editReply({ embeds: [embeds.success('Check your DMs ✦')] });
    } else {
      const note = where === 'fallback' ? 'I couldn\'t DM you, so here it is (only you can see this).' : null;
      await interaction.editReply({ content: note ?? undefined, embeds: [accountEmbed] });
    }

    if (settings.log_channel_id) {
      const channel = interaction.guild.channels.cache.get(settings.log_channel_id);
      if (channel?.isTextBased()) {
        const log = embeds.brand('Account generated')
          .addFields(
            { name: 'User', value: `${user} (${user.id})`, inline: true },
            { name: 'Category', value: category, inline: true },
            { name: 'Username', value: account.username, inline: true },
          );
        if (remaining !== null) log.addFields({ name: 'Remaining', value: String(remaining), inline: true });
        channel.send({ embeds: [log] }).catch(() => {});
      }
    }

    if (remaining === 0) {
      interaction.followUp({ embeds: [embeds.warn(`That was the last one in **${category}**.`)], flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  },
};
