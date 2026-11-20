const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('node:path');
const embeds = require('../../util/embeds');

const SECTIONS = {
  accounts: { label: '✦ Accounts', admin: false },
  admin: { label: '✦ Admin', admin: true },
  support: { label: '✦ Support', admin: false },
  general: { label: '✦ General', admin: false },
  fun: { label: '✦ Fun', admin: false },
  moderation: { label: '✦ Moderation', admin: false },
};

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('See everything Destiny can do.'),

  async execute(interaction) {
    const banner = new AttachmentBuilder(path.join(__dirname, '..', '..', '..', 'assets', 'banner.png'), { name: 'banner.png' });
    const e = embeds.brand('Destiny', 'Your fate, one command away.').setImage('attachment://banner.png');

    const bySection = {};
    for (const cmd of interaction.client.commands.values()) {
      (bySection[cmd.section] ??= []).push(cmd);
    }
    for (const [key, { label }] of Object.entries(SECTIONS)) {
      const cmds = bySection[key];
      if (!cmds?.length) continue;
      const lines = cmds.flatMap((c) => {
        const json = c.data.toJSON();
        const subs = (json.options ?? []).filter((o) => o.type === 1);
        return subs.length
          ? subs.map((s) => `\`/${json.name} ${s.name}\` — ${s.description}`)
          : [`\`/${json.name}\` — ${json.description}`];
      });
      e.addFields({ name: label, value: lines.join('\n').slice(0, 1024) });
    }
    await interaction.reply({ embeds: [e], files: [banner] });
  },
};
