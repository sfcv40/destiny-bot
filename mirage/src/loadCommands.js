const fs = require('node:fs');
const path = require('node:path');

/** Load every command module under src/commands/<section>/*.js */
module.exports = function loadCommands() {
  const commands = new Map();
  const root = path.join(__dirname, 'commands');
  for (const section of fs.readdirSync(root)) {
    const dir = path.join(root, section);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const cmd = require(path.join(dir, file));
      if (!cmd.data || !cmd.execute) throw new Error(`Command ${section}/${file} is missing data or execute`);
      cmd.section = section;
      commands.set(cmd.data.name, cmd);
    }
  }
  return commands;
};
