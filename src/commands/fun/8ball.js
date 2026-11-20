const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../util/embeds');

const ANSWERS = [
  'It is written in the stars.', 'Destiny says yes.', 'Without a doubt.', 'The crystal shines bright — yes.',
  'Signs point to yes.', 'Most likely.', 'The future is clouded. Ask again.', 'Fate is undecided.',
  'Better not tell you now.', 'Concentrate and ask again.', 'Do not count on it.', 'The stars say no.',
  'Destiny has other plans.', 'Very doubtful.', 'The crystal has shattered — no.',
];

module.exports = {
  data: new SlashCommandBuilder().setName('8ball').setDescription('Ask Destiny a question.')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(250)),
  async execute(interaction) {
    const q = interaction.options.getString('question');
    const a = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    await interaction.reply({ embeds: [embeds.brand('✦ The crystal speaks').addFields({ name: 'Question', value: q }, { name: 'Answer', value: a })] });
  },
};
