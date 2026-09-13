const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { colors, row, err } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency'),
  ns: 'pg',
  embed(i, sent) {
    return new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 Roundtrip', value: `${sent.createdTimestamp - i.createdTimestamp}ms`, inline: true },
        { name: '💓 API', value: `${Math.round(i.client.ws.ping)}ms`, inline: true },
      )
      .setColor(colors.good);
  },
  buttons(i, ctx) {
    const g = ctx.guild(i.guildId);
    const isHere = g.onlineChannelId === i.channelId;
    return [row(
      new ButtonBuilder().setCustomId('pg:online').setLabel(isHere ? '🔕 Stop Online Alerts Here' : '🔔 Announce Online Here').setStyle(isHere ? ButtonStyle.Danger : ButtonStyle.Secondary),
    )];
  },
  async run(i, ctx) {
    const sent = await i.reply({ content: '🏓 Pinging…', fetchReply: true });
    return i.editReply({
      content: '',
      embeds: [this.embed(i, sent)],
      components: this.buttons(i, ctx),
    });
  },
  async onButton(i, ctx) {
    if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** to set this.');
    const g = ctx.guild(i.guildId);
    g.onlineChannelId = g.onlineChannelId === i.channelId ? null : i.channelId;
    ctx.save();
    return i.update({
      content: g.onlineChannelId ? `🔔 I'll announce here whenever I come online.` : `🔕 Online announcements disabled for this channel.`,
      components: this.buttons(i, ctx),
    });
  },
};
