const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('📊 Create a reaction poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName('option3').setDescription('Option 3 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option4').setDescription('Option 4 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option5').setDescription('Option 5 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option6').setDescription('Option 6 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option7').setDescription('Option 7 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option8').setDescription('Option 8 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option9').setDescription('Option 9 (optional)').setMaxLength(50))
    .addStringOption(o => o.setName('option10').setDescription('Option 10 (optional)').setMaxLength(50)),
  async run(i) {
    const question = i.options.getString('question');
    const options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => i.options.getString(`option${n}`)).filter(Boolean);
    const digits = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setDescription(options.map((o, x) => `${digits[x + 1]} ${o}`).join('\n'))
      .setAuthor({ name: `Poll by ${i.user.username}`, iconURL: i.user.displayAvatarURL() })
      .setColor(colors.main);
    const msg = await i.channel.send({ embeds: [embed] });
    for (let x = 1; x <= options.length; x++) await msg.react(digits[x]).catch(() => {});
    return i.reply({ content: '✅ Poll created.', ephemeral: true });
  },
};
