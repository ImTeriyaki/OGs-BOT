const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('stats').setDescription('📈 Server stats'),
  async run(i) {
    const { guild } = i;
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle('📈 Server Stats')
        .setColor(colors.main)
        .addFields(
          { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
          { name: '💬 Text Channels', value: `${guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size}`, inline: true },
          { name: '🔊 Voice Channels', value: `${guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size}`, inline: true },
          { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
          { name: '📁 Categories', value: `${guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size}`, inline: true },
        )
        .setTimestamp()],
    });
  },
};
