const { EmbedBuilder } = require('discord.js');

// Mirage's look: deep violet glow.
const COLORS = { brand: 0x9b30ff, success: 0xb36bff, error: 0x3a0a5c, warn: 0xd4a0ff };

const brand = (title, description) => {
  const e = new EmbedBuilder().setColor(COLORS.brand).setFooter({ text: '✦ Mirage' }).setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
};
const success = (d) => brand(null, `✦ ${d}`).setColor(COLORS.success);
const error = (d) => brand(null, `✧ ${d}`).setColor(COLORS.error);
const warn = (d) => brand(null, `✧ ${d}`).setColor(COLORS.warn);

module.exports = { COLORS, brand, success, error, warn };
