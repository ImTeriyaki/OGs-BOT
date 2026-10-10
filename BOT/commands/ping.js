const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Bot latency'),
  embed(i, sent) {
    return new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 Roundtrip', value: `${sent.createdTimestamp - i.createdTimestamp}ms`, inline: true },
        { name: '💓 API', value: `${Math.round(i.client.ws.ping)}ms`, inline: true },
      )
      .setColor(colors.good);
  },
  async run(i) {
    const sent = await i.reply({ content: '🏓 Pinging…', fetchReply: true });
    return i.editReply({ content: '', embeds: [this.embed(i, sent)] });
  },
};
