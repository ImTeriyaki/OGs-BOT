const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { colors, row, menu, MSG_TEMPLATES, MSG_COLORS, msgState, msgPreview, msgChannelRow } = require('./_shared');

/* select-option values are indexes into this, not the raw "title|message" text —
   that text can exceed Discord's 100-char option-value limit and get silently truncated */
const wlcmTemplates = () => Object.entries(MSG_TEMPLATES).filter(([k]) => !k.startsWith('🚪'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('⚙️ Configure the welcome message — all buttons, no typing')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'wlcm',
  panel(i, g) {
    const s = g.welcome;
    return [
      row(
        new ButtonBuilder().setCustomId('wlcm:toggle').setLabel(s.enabled ? 'Disable' : 'Enable').setEmoji(s.enabled ? '🔴' : '🟢').setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('wlcm:avatar').setLabel(`Avatar: ${s.showAvatar ? 'On' : 'Off'}`).setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wlcm:count').setLabel(`Show #: ${s.showMemberCount ? 'On' : 'Off'}`).setEmoji('👥').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wlcm:dm').setLabel(`DM Greeting: ${s.dmUser ? 'On' : 'Off'}`).setEmoji('✉️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('wlcm:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
      ),
      row(menu('wlcm:template', '📝 Pick a welcome template…',
        wlcmTemplates().map(([, name], idx) => ({ label: name, value: String(idx), emoji: '📝' })))),
      row(menu('wlcm:color', '🎨 Pick an embed color…',
        MSG_COLORS.map(c => ({ label: c.label, value: c.hex, emoji: '🎨', default: c.hex === s.color })))),
      msgChannelRow('wlcm', i, s),
    ];
  },
  embed(i, g) {
    const s = g.welcome;
    return [
      msgPreview('welcome', s, i.guild),
      new EmbedBuilder().setTitle('👋 Welcome Builder').setColor(s.enabled ? colors.good : colors.main)
        .setDescription(`**Status:** ${s.enabled ? '✅ Enabled' : '❌ Disabled'}${s.channelId ? `\n**Channel:** <#${s.channelId}>` : '\n**Channel:** *pick one below*'}\n**DM Greeting:** ${s.dmUser ? '✅ On' : '❌ Off'}`),
    ];
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    msgState(g, 'welcome');
    ctx.save();
    return i.reply({ embeds: this.embed(i, g), components: this.panel(i, g), ephemeral: true });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    msgState(g, 'welcome');
    const action = i.customId.split(':')[1];
    if (action === 'toggle') g.welcome.enabled = !g.welcome.enabled;
    if (action === 'avatar') g.welcome.showAvatar = !g.welcome.showAvatar;
    if (action === 'count') g.welcome.showMemberCount = !g.welcome.showMemberCount;
    if (action === 'dm') g.welcome.dmUser = !g.welcome.dmUser;
    if (action === 'close') return i.update({ content: '✖️ Closed.', embeds: [], components: [] });
    ctx.save();
    return i.update({ embeds: this.embed(i, g), components: this.panel(i, g) });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    msgState(g, 'welcome');
    if (i.customId === 'wlcm:template') {
      const entry = wlcmTemplates()[parseInt(i.values[0], 10)];
      if (entry) {
        const sep = entry[0].indexOf('|');
        g.welcome.title = entry[0].slice(0, sep);
        g.welcome.message = entry[0].slice(sep + 1);
        if (g.welcome.showMemberCount && !g.welcome.message.includes('#{membercount}')) g.welcome.message += '\nYou are member #{membercount}.';
      }
    }
    if (i.customId === 'wlcm:color') g.welcome.color = i.values[0];
    if (i.customId === 'wlcm:channel') g.welcome.channelId = i.values[0];
    ctx.save();
    return i.update({ embeds: this.embed(i, g), components: this.panel(i, g) });
  },
};
