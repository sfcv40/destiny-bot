const { PermissionFlagsBits } = require('discord.js');
const embeds = require('./embeds');

const ownerIds = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

/** Owners: anyone in OWNER_IDS, plus the server owner. Owners bypass every check and can never be targeted. */
const isOwner = (userId, guild) => ownerIds.has(userId) || (guild && guild.ownerId === userId);

const hasPerm = (interaction, perm) =>
  isOwner(interaction.user.id, interaction.guild) ||
  Boolean(interaction.memberPermissions?.has(perm ?? PermissionFlagsBits.Administrator));

/**
 * Can the person running the command (and Mirage itself) act on this member?
 * Returns an error embed, or null when it's allowed.
 */
function checkTarget(interaction, member, { allowSelf = false } = {}) {
  if (!member) return null;
  const { guild, user } = interaction;
  if (isOwner(member.id, guild)) return embeds.error('Mirage will never act against its owner.');
  if (member.id === guild.members.me.id) return embeds.error('Nice try.');
  const self = member.id === user.id;
  if (self && !allowSelf) return embeds.error('You can\'t do that to yourself.');
  if (!self && !isOwner(user.id, guild) && member.roles.highest.position >= interaction.member.roles.highest.position) {
    return embeds.error(`${member}'s highest role is equal to or above yours.`);
  }
  if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
    return embeds.error(`${member}'s highest role is above mine. Drag **Mirage**'s role higher in Server Settings → Roles.`);
  }
  return null;
}

/** Can this person (and Mirage) manage this role? */
function checkRole(interaction, role) {
  const { guild, user } = interaction;
  if (role.managed) return embeds.error(`${role} is managed by an integration and can't be changed.`);
  if (role.id === guild.id) return embeds.error('That\'s the @everyone role.');
  if (role.position >= guild.members.me.roles.highest.position) {
    return embeds.error(`${role} is above my highest role. Drag **Mirage**'s role higher in Server Settings → Roles.`);
  }
  if (!isOwner(user.id, guild) && role.position >= interaction.member.roles.highest.position) {
    return embeds.error(`${role} is equal to or above your highest role.`);
  }
  return null;
}

module.exports = { isOwner, hasPerm, checkTarget, checkRole };
