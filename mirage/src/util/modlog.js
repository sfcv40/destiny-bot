const db = require('../db');
const embeds = require('./embeds');

/** Post an action to the server's mod log channel, if one is set. */
async function modlog(guild, { action, moderator, target, reason, extra = [] }) {
  const { modlog_channel_id: id } = db.getSettings(guild.id);
  const channel = id && guild.channels.cache.get(id);
  if (!channel?.isTextBased()) return;
  const e = embeds.brand(`✦ ${action}`).addFields(
    ...(target ? [{ name: 'Target', value: String(target), inline: true }] : []),
    { name: 'By', value: String(moderator), inline: true },
    ...extra,
    ...(reason ? [{ name: 'Reason', value: reason.slice(0, 1024) }] : []),
  );
  await channel.send({ embeds: [e] }).catch(() => {});
}

module.exports = { modlog };
