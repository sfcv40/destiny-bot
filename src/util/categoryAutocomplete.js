const db = require('../db');

/** Autocomplete handler that suggests this server's stock categories with counts. */
module.exports = async function categoryAutocomplete(interaction) {
  if (!interaction.guildId) return interaction.respond([]);
  const focused = interaction.options.getFocused().toLowerCase();
  const choices = db.stockSummary(interaction.guildId)
    .filter((r) => r.category.includes(focused))
    .slice(0, 25)
    .map((r) => ({ name: `${r.category} — ${r.available} available`, value: r.category }));
  await interaction.respond(choices);
};
