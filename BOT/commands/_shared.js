const fs = require('fs');
const path = require('path');
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

/* ═══════════════════════════ admin action log ═══════════════════════════
   every moderation action (ban/kick/timeout/warn/etc.) appends one line here,
   so admins have a plain-text trail they can view or download — see /logs' buttons. */
const ADMIN_LOG_PATH = path.join(__dirname, '..', '..', 'admin-log.txt');

function logAdmin(i, action, detail = '') {
  const line = `[${new Date().toISOString()}] guild:${i.guildId} (${i.guild?.name ?? 'unknown'}) | ${i.user.tag} (${i.user.id}) | ${action}${detail ? ' — ' + detail : ''}\n`;
  fs.appendFile(ADMIN_LOG_PATH, line, () => {});
}

/* lines for one guild only — the log file is shared across every guild the bot is in */
function readAdminLog(guildId, limit = Infinity) {
  if (!fs.existsSync(ADMIN_LOG_PATH)) return [];
  const lines = fs.readFileSync(ADMIN_LOG_PATH, 'utf8').split('\n').filter(l => l.includes(`guild:${guildId} `));
  return lines.slice(-limit);
}

/* rich per-action embeds posted to g.modLogChannelId (set via /logs), styled like:
   "USER HAS BEEN MUTED" / "@admin has muted @target" / Reason + Time fields /
   a Remaining Time field for actions with a real expiry. Uses Discord's own
   <t:...:R> relative timestamp for Remaining Time so it live-counts-down with
   zero bot-side polling or message edits. */
const ACTION_META = {
  ban: { title: 'USER HAS BEEN BANNED', verb: 'banned' },
  kick: { title: 'USER HAS BEEN KICKED', verb: 'kicked' },
  mute: { title: 'USER HAS BEEN MUTED', verb: 'muted' },
  unmute: { title: 'USER HAS BEEN UNMUTED', verb: 'unmuted' },
  timeout: { title: 'USER HAS BEEN TIMED OUT', verb: 'timed out' },
  'timeout-remove': { title: 'TIMEOUT HAS BEEN REMOVED', verb: 'removed the timeout from' },
  warn: { title: 'USER HAS BEEN WARNED', verb: 'warned' },
  'clear-warnings': { title: 'WARNINGS HAVE BEEN CLEARED', verb: 'cleared the warnings of' },
  'role-add': { title: 'A ROLE HAS BEEN ADDED', verb: 'added a role to' },
  'role-remove': { title: 'A ROLE HAS BEEN REMOVED', verb: 'removed a role from' },
  nickname: { title: 'A NICKNAME HAS BEEN CHANGED', verb: 'changed the nickname of' },
  purge: { title: 'MESSAGES HAVE BEEN PURGED', verb: 'purged messages from' },
  lock: { title: 'CHANNEL HAS BEEN LOCKED', verb: 'locked' },
  unlock: { title: 'CHANNEL HAS BEEN UNLOCKED', verb: 'unlocked' },
  slowmode: { title: 'SLOWMODE HAS BEEN UPDATED', verb: 'updated the slowmode of' },
};

async function postModLog(i, g, embed) {
  if (!g.modLogChannelId) return;
  const ch = await i.guild.channels.fetch(g.modLogChannelId).catch(() => null);
  if (!ch) return;
  await ch.send({ embeds: [embed] }).catch(() => {});
}

/* one call does both: appends the plain-text admin-log line AND, if a mod log
   channel is configured, posts the styled embed. `target`/`targetLabel` are the
   mention and plain-text form of whatever was acted on (a member or a channel). */
async function recordAdminAction(i, g, action, target, targetLabel, { reason, timeLabel, endTimestamp } = {}) {
  logAdmin(i, action, `${targetLabel}${reason ? ' — ' + reason : timeLabel ? ' — ' + timeLabel : ''}`);

  const meta = ACTION_META[action];
  if (!meta) return;
  const fields = [];
  if (reason) fields.push({ name: 'Reason', value: reason, inline: true });
  if (timeLabel) fields.push({ name: 'Time', value: timeLabel, inline: true });
  if (endTimestamp) fields.push({ name: 'Remaining Time', value: `<t:${Math.floor(endTimestamp / 1000)}:R>` });
  const embed = new EmbedBuilder()
    .setTitle(meta.title)
    .setDescription(`${i.user} has ${meta.verb} ${target}`)
    .setColor(colors.bad)
    .setTimestamp();
  if (fields.length) embed.addFields(fields);
  await postModLog(i, g, embed);
}

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

/* ═══════════════════════════ welcome/goodbye builder data (shared by welcome.js, goodbye.js) ═══════════════════════════
   Kept as two separate, explicit lists rather than one object filtered by emoji prefix — that
   filter used to misfile "💨 Another one gone" (a goodbye template) into welcome's dropdown
   too, since it doesn't start with 🚪, leaving welcome with two options both labeled "Fun"
   and goodbye missing its own "Fun" template entirely. */
const WELCOME_TEMPLATES = [
  { name: 'Classic', title: '👋 Welcome!', message: 'Welcome to {server}, {user}! You are member #{membercount}.' },
  { name: 'Friendly', title: '🎉 Welcome aboard!', message: 'Hey {user}, welcome to **{server}**! Make yourself at home — you are member #{membercount}.' },
  { name: 'Fun', title: '✨ A new member appears', message: '{user} just joined **{server}**. Say hi!' },
  { name: 'Fantasy', title: '🏰 Welcome to the kingdom', message: 'Greetings {user}. You are the **{membercount}**th member of {server}.' },
];
const GOODBYE_TEMPLATES = [
  { name: 'Classic', title: '🚪 Goodbye', message: '{username} left {server}.' },
  { name: 'Friendly', title: '🚪 We\'ll miss you', message: '**{username}** has left the server. Member count is now {membercount}.' },
  { name: 'Fun', title: '💨 Another one gone', message: '{username} vanished into the void.' },
];
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
  dmMessage: type === 'welcome' ? 'Welcome to {server}, {user}!' : '{username} left {server}.',
  color: type === 'welcome' ? '#5865F2' : '#ED4245',
  showAvatar: true, showMemberCount: false, dmUser: false, banner: null,
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
  if (s.banner) e.setImage(s.banner);
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
  WELCOME_TEMPLATES, GOODBYE_TEMPLATES, MSG_COLORS, msgDefaults, msgState, msgPreview, msgChannelRow,
  logAdmin, readAdminLog, ADMIN_LOG_PATH, recordAdminAction,
};
