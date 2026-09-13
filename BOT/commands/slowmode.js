const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('slowmode').setDescription('🐢 Set channel slowmode — dropdown presets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  ns: 'slow',
  async run(i) {
    const presets = [['Off', 0], ['5s', 5], ['10s', 10], ['30s', 30], ['1m', 60], ['5m', 300], ['15m', 900], ['1h', 3600], ['6h', 21600]];
    const sel = new StringSelectMenuBuilder().setCustomId('slow:pick').setPlaceholder('🐢 Pick a slowmode…')
      .addOptions(presets.map(([l, v]) => ({ label: l, value: String(v), emoji: '🐢', default: i.channel.rateLimitPerUser === v })));
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('🐢 Slowmode').setColor(colors.main)
        .setDescription(`Current: **${i.channel.rateLimitPerUser ? `${i.channel.rateLimitPerUser}s` : 'Off'}** in ${i.channel}`)],
      components: [row(sel)],
      ephemeral: true,
    });
  },
  async onSelect(i) {
    const seconds = parseInt(i.values[0], 10);
    await i.channel.setRateLimitPerUser(seconds);
    return i.update({ content: seconds === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to **${seconds}s**.`, components: [] });
  },
};
