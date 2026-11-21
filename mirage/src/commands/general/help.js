const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const path = require('node:path');
const embeds = require('../../util/embeds');

const SECTIONS = ['moderation', 'roles', 'channels', 'server', 'messages', 'config', 'general'];

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Everything Mirage can do.'),
  async execute(interaction) {
    const banner = new AttachmentBuilder(path.join(__dirname, '..', '..', '..', 'assets', 'banner.png'), { name: 'banner.png' });
    const e = embeds.brand('Mirage', 'Above all. Answers to one.').setImage('attachment://banner.png');
    for (const section of SECTIONS) {
      const lines = [...interaction.client.commands.values()].filter((c) => c.section === section).flatMap((c) => {
        const json = c.data.toJSON();
        const subs = (json.options ?? []).filter((o) => o.type === 1);
        return subs.length ? [`\`/${json.name}\` ${subs.map((s) => s.name).join(' · ')}`] : [`\`/${json.name}\` — ${json.description}`];
      });
      if (lines.length) e.addFields({ name: `✦ ${section[0].toUpperCase()}${section.slice(1)}`, value: lines.join('\n').slice(0, 1024) });
    }
    await interaction.reply({ embeds: [e], files: [banner], flags: MessageFlags.Ephemeral });
  },
};
