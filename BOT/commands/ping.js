const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, formatDuration } = require('./_shared');

function rating(ms) {
  if (ms < 150) return '🟢 Excellent';
  if (ms < 300) return '🟡 Good';
  if (ms < 600) return '🟠 Poor';
  return '🔴 Bad';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Detailed bot latency and connection diagnostics (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async run(i) {
    const sent = await i.reply({ content: '🏓 Pinging…', fetchReply: true });
    const roundtrip = sent.createdTimestamp - i.createdTimestamp;

    const apiStart = Date.now();
    await i.client.application.fetch().catch(() => {});
    const apiLatency = Date.now() - apiStart;

    const heartbeat = Math.round(i.client.ws.ping);
    const mem = process.memoryUsage();

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong! — Connection Diagnostics')
      .setColor(heartbeat < 150 ? colors.good : heartbeat < 300 ? colors.warn : colors.bad)
      .addFields(
        { name: '📡 Message Roundtrip', value: `${roundtrip}ms\n${rating(roundtrip)}`, inline: true },
        { name: '💓 WebSocket Heartbeat', value: `${heartbeat}ms\n${rating(heartbeat)}`, inline: true },
        { name: '🌐 API (REST) Latency', value: `${apiLatency}ms\n${rating(apiLatency)}`, inline: true },
        { name: '⏱️ Bot Uptime', value: formatDuration(i.client.uptime), inline: true },
        { name: '🧠 Memory Usage', value: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`, inline: true },
        { name: '🏢 Servers', value: `${i.client.guilds.cache.size}`, inline: true },
        { name: '🧩 discord.js', value: require('discord.js').version, inline: true },
        { name: '🟢 Node.js', value: process.version, inline: true },
        { name: '💻 Platform', value: `${process.platform} (${process.arch})`, inline: true },
      )
      .setFooter({ text: `Requested by ${i.user.tag}` })
      .setTimestamp();

    return i.editReply({ content: '', embeds: [embed] });
  },
};
