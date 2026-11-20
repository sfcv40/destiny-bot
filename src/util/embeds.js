const { EmbedBuilder } = require('discord.js');

// Destiny's look: monochrome, crystalline.
const COLORS = {
  brand: 0xe8e8f0,
  success: 0xd9f2e6,
  error: 0x2b2d31,
  warn: 0xf0e6c8,
};

const brand = (title, description) => {
  const e = new EmbedBuilder().setColor(COLORS.brand).setFooter({ text: '✦ Destiny' }).setTimestamp();
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  return e;
};

const success = (description) => brand('✦ Done', description).setColor(COLORS.success);
const error = (description) => brand('✧ Something went wrong', description).setColor(COLORS.error);
const warn = (description) => brand('✧ Heads up', description).setColor(COLORS.warn);

module.exports = { COLORS, brand, success, error, warn };
