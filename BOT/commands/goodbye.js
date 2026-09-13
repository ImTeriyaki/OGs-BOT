const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { colors, row, menu, GOODBYE_TEMPLATES, MSG_COLORS, msgState, msgPreview, msgChannelRow } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('goodbye')
    .setDescription('⚙️ Configure the goodbye message — all buttons, no typing')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'gbye',
  panel(i, s) {
    return [
      row(
        new ButtonBuilder().setCustomId('gbye:toggle').setLabel(s.enabled ? 'Disable' : 'Enable').setEmoji(s.enabled ? '🔴' : '🟢').setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('gbye:avatar').setLabel(`Avatar: ${s.showAvatar ? 'On' : 'Off'}`).setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('gbye:count').setLabel(`Show #: ${s.showMemberCount ? 'On' : 'Off'}`).setEmoji('👥').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('gbye:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
      ),
      row(menu('gbye:template', '📝 Pick a goodbye template…',
        GOODBYE_TEMPLATES.map((t, idx) => ({ label: t.name, value: String(idx), emoji: '📝' })))),
      row(menu('gbye:color', '🎨 Pick an embed color…',
        MSG_COLORS.map(c => ({ label: c.label, value: c.hex, emoji: '🎨', default: c.hex === s.color })))),
      msgChannelRow('gbye', i, s),
    ];
  },
  embed(i, s) {
    return [
      msgPreview('goodbye', s, i.guild),
      new EmbedBuilder().setTitle('🚪 Goodbye Builder').setColor(s.enabled ? colors.good : colors.main)
        .setDescription(`**Status:** ${s.enabled ? '✅ Enabled' : '❌ Disabled'}${s.channelId ? `\n**Channel:** <#${s.channelId}>` : '\n**Channel:** *pick one below*'}`),
    ];
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    msgState(g, 'goodbye');
    ctx.save();
    return i.reply({ embeds: this.embed(i, g.goodbye), components: this.panel(i, g.goodbye), ephemeral: true });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    msgState(g, 'goodbye');
    const action = i.customId.split(':')[1];
    if (action === 'toggle') g.goodbye.enabled = !g.goodbye.enabled;
    if (action === 'avatar') g.goodbye.showAvatar = !g.goodbye.showAvatar;
    if (action === 'count') g.goodbye.showMemberCount = !g.goodbye.showMemberCount;
    if (action === 'close') return i.update({ content: '✖️ Closed.', embeds: [], components: [] });
    ctx.save();
    return i.update({ embeds: this.embed(i, g.goodbye), components: this.panel(i, g.goodbye) });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    msgState(g, 'goodbye');
    if (i.customId === 'gbye:template') {
      const t = GOODBYE_TEMPLATES[parseInt(i.values[0], 10)];
      if (t) {
        g.goodbye.title = t.title;
        g.goodbye.message = t.message;
      }
    }
    if (i.customId === 'gbye:color') g.goodbye.color = i.values[0];
    if (i.customId === 'gbye:channel') g.goodbye.channelId = i.values[0];
    ctx.save();
    return i.update({ embeds: this.embed(i, g.goodbye), components: this.panel(i, g.goodbye) });
  },
};
