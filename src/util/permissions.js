const { PermissionFlagsBits } = require('discord.js');

const ownerIds = new Set(
  (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
);

const isOwner = (userId) => ownerIds.has(userId);

/** Owners and anyone with Manage Server can manage Destiny's stock and settings. */
const isAdmin = (interaction) =>
  isOwner(interaction.user.id) ||
  Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));

module.exports = { isOwner, isAdmin };
