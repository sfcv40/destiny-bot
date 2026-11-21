const { SlashCommandBuilder, PermissionFlagsBits: P, InteractionContextType, MessageFlags, resolveColor } = require('discord.js');
const embeds = require('../../util/embeds');
const { checkRole, checkTarget, isOwner } = require('../../util/authority');
const { modlog } = require('../../util/modlog');

const colorOpt = (o) => o.setName('color').setDescription('Hex color, e.g. #9b30ff');
const parseColor = (s) => {
  if (!s) return undefined;
  const hex = s.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error('Color must be a hex code like `#9b30ff`.');
  return resolveColor(`#${hex}`);
};

module.exports = {
  perm: P.ManageRoles,
  data: new SlashCommandBuilder().setName('role').setDescription('Manage roles.')
    .setContexts(InteractionContextType.Guild).setDefaultMemberPermissions(P.ManageRoles)
    .addSubcommand((s) => s.setName('give').setDescription('Give a member a role.')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('take').setDescription('Take a role from a member.')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('create').setDescription('Create a role.')
      .addStringOption((o) => o.setName('name').setDescription('Name').setRequired(true).setMaxLength(100))
      .addStringOption(colorOpt)
      .addBooleanOption((o) => o.setName('hoist').setDescription('Show members separately in the member list'))
      .addBooleanOption((o) => o.setName('mentionable').setDescription('Anyone can @mention it')))
    .addSubcommand((s) => s.setName('delete').setDescription('Delete a role.')
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('edit').setDescription('Edit a role.')
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('New name').setMaxLength(100))
      .addStringOption(colorOpt)
      .addBooleanOption((o) => o.setName('hoist').setDescription('Show members separately'))
      .addBooleanOption((o) => o.setName('mentionable').setDescription('Anyone can @mention it')))
    .addSubcommand((s) => s.setName('info').setDescription('Info about a role.')
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('all').setDescription('Give or take a role from EVERY member (admin).')
      .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
      .addStringOption((o) => o.setName('action').setDescription('Give or take').setRequired(true)
        .addChoices({ name: 'Give to everyone', value: 'give' }, { name: 'Take from everyone', value: 'take' }))
      .addBooleanOption((o) => o.setName('include_bots').setDescription('Include bots (default: no)'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild, user: mod } = interaction;
    const role = interaction.options.getRole('role');
    const eph = (e) => interaction.reply({ embeds: [e], flags: MessageFlags.Ephemeral });

    if (sub === 'info') {
      const perms = role.permissions.has(P.Administrator) ? 'Administrator (everything)' :
        role.permissions.toArray().join(', ') || 'None';
      return interaction.reply({ embeds: [embeds.brand(role.name).setColor(role.color || 0x9b30ff).addFields(
        { name: 'ID', value: role.id, inline: true },
        { name: 'Members', value: String(role.members.size), inline: true },
        { name: 'Position', value: String(role.position), inline: true },
        { name: 'Color', value: role.hexColor, inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Permissions', value: perms.slice(0, 1024) },
      )] });
    }

    if (sub === 'create') {
      let color;
      try { color = parseColor(interaction.options.getString('color')); } catch (e) { return eph(embeds.error(e.message)); }
      const created = await guild.roles.create({
        name: interaction.options.getString('name'), color,
        hoist: interaction.options.getBoolean('hoist') ?? false,
        mentionable: interaction.options.getBoolean('mentionable') ?? false,
        reason: `By ${mod.tag}`,
      });
      await interaction.reply({ embeds: [embeds.success(`Created ${created}.`)] });
      return modlog(guild, { action: 'Role created', moderator: mod, target: created });
    }

    const roleProblem = checkRole(interaction, role);
    if (roleProblem) return eph(roleProblem);

    if (sub === 'give' || sub === 'take') {
      const member = interaction.options.getMember('user');
      if (!member) return eph(embeds.error('That user isn\'t in this server.'));
      const targetProblem = checkTarget(interaction, member, { allowSelf: true });
      if (targetProblem && !(isOwner(member.id, guild) && sub === 'give')) return eph(targetProblem);
      if (sub === 'give') await member.roles.add(role, `By ${mod.tag}`);
      else await member.roles.remove(role, `By ${mod.tag}`);
      await interaction.reply({ embeds: [embeds.success(sub === 'give' ? `Gave ${role} to ${member}.` : `Took ${role} from ${member}.`)] });
      return modlog(guild, { action: sub === 'give' ? 'Role given' : 'Role taken', moderator: mod, target: member, extra: [{ name: 'Role', value: `${role}`, inline: true }] });
    }

    if (sub === 'delete') {
      const name = role.name;
      await role.delete(`By ${mod.tag}`);
      await interaction.reply({ embeds: [embeds.success(`Deleted role **${name}**.`)] });
      return modlog(guild, { action: 'Role deleted', moderator: mod, target: name });
    }

    if (sub === 'edit') {
      const changes = {};
      const name = interaction.options.getString('name');
      const hoist = interaction.options.getBoolean('hoist');
      const mentionable = interaction.options.getBoolean('mentionable');
      try { const c = parseColor(interaction.options.getString('color')); if (c !== undefined) changes.color = c; } catch (e) { return eph(embeds.error(e.message)); }
      if (name) changes.name = name;
      if (hoist !== null) changes.hoist = hoist;
      if (mentionable !== null) changes.mentionable = mentionable;
      if (!Object.keys(changes).length) return eph(embeds.warn('Nothing to change. Pick at least one option.'));
      await role.edit({ ...changes, reason: `By ${mod.tag}` });
      return interaction.reply({ embeds: [embeds.success(`Updated ${role}.`)] });
    }

    // sub === 'all'
    if (!interaction.memberPermissions.has(P.Administrator) && !isOwner(mod.id, guild)) {
      return eph(embeds.error('Mass role changes need **Administrator**.'));
    }
    const give = interaction.options.getString('action') === 'give';
    const bots = interaction.options.getBoolean('include_bots') ?? false;
    await interaction.deferReply();
    let members;
    try {
      members = await guild.members.fetch();
    } catch {
      return interaction.editReply({ embeds: [embeds.error('I couldn\'t load the member list. Turn on **Server Members Intent** in the Developer Portal → Bot, then restart me.')] });
    }
    const targets = [...members.values()].filter((m) => (bots || !m.user.bot) && (give ? !m.roles.cache.has(role.id) : m.roles.cache.has(role.id)));
    await interaction.editReply({ embeds: [embeds.brand(null, `✦ ${give ? 'Giving' : 'Taking'} ${role} ${give ? 'to' : 'from'} ${targets.length} member(s)… this can take a while.`)] });
    let done = 0;
    let failed = 0;
    for (const m of targets) {
      try {
        if (give) await m.roles.add(role, `Mass role by ${mod.tag}`);
        else await m.roles.remove(role, `Mass role by ${mod.tag}`);
        done++;
      } catch { failed++; }
    }
    await interaction.editReply({ embeds: [embeds.success(`${give ? 'Gave' : 'Took'} ${role} ${give ? 'to' : 'from'} **${done}** member(s).${failed ? ` ${failed} failed (they may outrank me).` : ''}`)] });
    modlog(guild, { action: give ? 'Mass role give' : 'Mass role take', moderator: mod, target: role, extra: [{ name: 'Members', value: String(done), inline: true }] });
  },
};
