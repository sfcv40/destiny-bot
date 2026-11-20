const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const embeds = require('../../util/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Info about this server.')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const g = interaction.guild;
    const owner = await g.fetchOwner().catch(() => null);
    const e = embeds.brand(g.name).setThumbnail(g.iconURL()).addFields(
      { name: 'Owner', value: owner ? `${owner.user}` : 'Unknown', inline: true },
      { name: 'Members', value: String(g.memberCount), inline: true },
      { name: 'Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
      { name: 'Channels', value: String(g.channels.cache.size), inline: true },
      { name: 'Roles', value: String(g.roles.cache.size), inline: true },
      { name: 'Boosts', value: `${g.premiumSubscriptionCount ?? 0} (tier ${g.premiumTier})`, inline: true },
    );
    if (g.bannerURL()) e.setImage(g.bannerURL({ size: 1024 }));
    await interaction.reply({ embeds: [e] });
  },
};
