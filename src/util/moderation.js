const embeds = require('./embeds');

/** Make sure the moderator and the bot both outrank the target. Returns an error embed or null. */
function checkHierarchy(interaction, targetMember) {
  if (!targetMember) return null;
  const me = interaction.guild.members.me;
  if (targetMember.id === interaction.user.id) return embeds.error('You can\'t do that to yourself.');
  if (targetMember.id === interaction.guild.ownerId) return embeds.error('You can\'t do that to the server owner.');
  if (interaction.user.id !== interaction.guild.ownerId &&
      targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
    return embeds.error('That member\'s highest role is equal to or above yours.');
  }
  if (targetMember.roles.highest.position >= me.roles.highest.position) {
    return embeds.error('That member\'s highest role is equal to or above mine.');
  }
  return null;
}

module.exports = { checkHierarchy };
