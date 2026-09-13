const { ActionRowBuilder, ChannelType, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');

/* ═══════════════════════════ shared ═══════════════════════════ */
const colors = { main: 0x5865F2, good: 0x57F287, bad: 0xED4245, warn: 0xFEE75C };

const row = (...components) => new ActionRowBuilder().addComponents(...components);

const err = (i, msg) => {
  const payload = { content: `⚠️ ${msg}`, ephemeral: true };
  return i.replied || i.deferred ? i.editReply(payload) : i.reply(payload);
};

const menu = (id, placeholder, options, extra = {}) =>
  new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options, extra);

const textChannels = (i, limit = 25) =>
  i.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(limit);

const voiceChannels = (i, limit = 25) =>
  i.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).first(limit);

const categories = (i, limit = 25) =>
  i.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).first(limit);

const rolesMenu = (i) =>
  i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25)
    .map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🏷️' }));

function formatDuration(milliseconds) {
  let seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/* ═══════════════════════════ welcome/goodbye builder data (shared by welcome.js, goodbye.js, rolecreate.js) ═══════════════════════════ */
const MSG_TEMPLATES = {
  '👋 Welcome!|Welcome to {server}, {user}! You are member #{membercount}.': 'Classic',
  '🎉 Welcome aboard!|Hey {user}, welcome to **{server}**! Make yourself at home — you are member #{membercount}.': 'Friendly',
  '✨ A new member appears|{user} just joined **{server}**. Say hi!': 'Fun',
  '🏰 Welcome to the kingdom|Greetings {user}. You are the **{membercount}**th member of {server}.': 'Fantasy',
  '🚪 Goodbye|{username} left {server}.': 'Classic',
  '🚪 We\'ll miss you|**{username}** has left the server. Member count is now {membercount}.': 'Friendly',
  '💨 Another one gone|{username} vanished into the void.': 'Fun',
};
const MSG_COLORS = [
  { label: 'Blurple', hex: '#5865F2' }, { label: 'Green', hex: '#57F287' },
  { label: 'Red', hex: '#ED4245' }, { label: 'Yellow', hex: '#FEE75C' },
  { label: 'Pink', hex: '#EB459E' }, { label: 'Cyan', hex: '#00B0F4' },
  { label: 'Orange', hex: '#E67E22' }, { label: 'Black', hex: '#23272A' },
];

const msgDefaults = (type) => ({
  enabled: false, channelId: null,
  title: type === 'welcome' ? '👋 Welcome!' : '🚪 Goodbye',
  message: type === 'welcome' ? 'Welcome to {server}, {user}!' : '{username} left {server}.',
  color: type === 'welcome' ? '#5865F2' : '#ED4245',
  showAvatar: true, showMemberCount: false, dmUser: false,
});

/* normalize + backfill g.welcome/g.goodbye in place — plain `g[type] ??= msgDefaults(type)`
   is not enough because defaultGuild() pre-seeds these as `{}`, so the ??= never fires and
   fields like title/message stay undefined forever (crashes EmbedBuilder.setTitle) */
function msgState(g, type) {
  const d = msgDefaults(type);
  const s = g[type] ??= d;
  for (const k of Object.keys(d)) s[k] ??= d[k];
  return s;
}

function msgPreview(type, s, guild) {
  const filled = (s.message || '')
    .replaceAll('{user}', '@NewMember')
    .replaceAll('{username}', 'NewMember')
    .replaceAll('{server}', guild.name)
    .replaceAll('{membercount}', String(guild.memberCount + 1));
  const e = new EmbedBuilder()
    .setTitle(s.title)
    .setDescription(filled)
    .setColor(parseInt(s.color.replace('#', ''), 16) || colors.main)
    .setFooter({ text: `${type === 'welcome' ? '👋 Welcome preview' : '🚪 Goodbye preview'} • ${guild.name}` })
    .setTimestamp();
  if (s.showAvatar) e.setThumbnail(guild.iconURL({ size: 128 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png');
  return e;
}

/* proper channel row builder (needs interaction for guild) */
function msgChannelRow(ns, i, s) {
  const chans = textChannels(i);
  return row(menu(`${ns}:channel`, '📺 Pick the post channel…',
    chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: c.id === s.channelId }))));
}

module.exports = {
  colors, row, err, menu, textChannels, voiceChannels, categories, rolesMenu, formatDuration,
  MSG_TEMPLATES, MSG_COLORS, msgDefaults, msgState, msgPreview, msgChannelRow,
};
