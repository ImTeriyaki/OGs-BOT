const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors, formatDuration } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription('🤖 Bot information'),
  async run(i, ctx) {
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🤖 OGs Bot')
        .setThumbnail(i.client.user.displayAvatarURL({ size: 512 }))
        .setColor(colors.main)
        .addFields(
          { name: '📡 Ping', value: `${Math.round(i.client.ws.ping)}ms`, inline: true },
          { name: '⏱️ Uptime', value: formatDuration(i.client.uptime), inline: true },
          { name: '🏢 Servers', value: `${i.client.guilds.cache.size}`, inline: true },
          { name: '👥 Users', value: `${i.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`, inline: true },
          { name: '⚙️ Commands', value: `${ctx.commands.length}`, inline: true },
          { name: '🧠 discord.js', value: require('discord.js').version, inline: true },
        )],
    });
  },
};
