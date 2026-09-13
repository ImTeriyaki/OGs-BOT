const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('boosts').setDescription('🚀 Boost status'),
  async run(i) {
    const { guild } = i;
    const perks = ['💎 Better audio quality', '📄 More emoji slots', '🎨 Server banner & animated icon', '📎 Bigger upload limits'];
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🚀 Server Boosts')
        .setDescription(`**${guild.premiumSubscriptionCount ?? 0}** boosts — **Level ${guild.premiumTier}**`)
        .addFields({ name: 'Perks unlocked', value: perks.slice(0, guild.premiumTier + 1).join('\n') || '*None yet — boost to unlock perks!*' })
        .setColor(colors.main)],
    });
  },
};
