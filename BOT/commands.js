const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
  PermissionFlagsBits, ChannelType,
} = require('discord.js');

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

/* ═══════════════════════════ /commands pages ═══════════════════════════ */
const cmdPages = [
  { name: 'Setup', emoji: '⚙️', commands: [
    { n: 'welcome', d: 'Welcome message builder — templates, colors & channel, all buttons.', u: '/welcome' },
    { n: 'goodbye', d: 'Goodbye message builder — templates, colors & channel, all buttons.', u: '/goodbye' },
    { n: 'announce', d: 'Visual announcement builder — pick channel, ping, color & style, then send.', u: '/announce' },
    { n: 'jointocreate', d: 'Join-to-Create voice lobbies — pick lobby & category from dropdowns.', u: '/jointocreate' },
    { n: 'autorole', d: 'Roles automatically given when members join. Multi-select dropdown panel.', u: '/autorole' },
    { n: 'selfroles', d: 'Roles members can pick for themselves from a dropdown menu.', u: '/selfroles' },
    { n: 'ticket', d: 'Post a support ticket panel — pick channels from dropdowns.', u: '/ticket' },
    { n: 'logs', d: 'Set the error log channel from a dropdown.', u: '/logs' },
    { n: 'honeypot', d: 'Anti-raid trap channels — deploy, punishment, message, whitelist — all from one panel of buttons.', u: '/honeypot' },
    { n: 'refresh', d: 'Re-register slash commands instantly (admin only).', u: '/refresh' },
  ]},
  { name: 'Moderation', emoji: '🛡️', commands: [
    { n: 'purge', d: 'Bulk delete messages — pick the amount from a dropdown, optionally one user.', u: '/purge [user:@user]' },
    { n: 'slowmode', d: 'Set slowmode from a dropdown of presets. Off included.', u: '/slowmode' },
    { n: 'lock', d: 'Lock this channel so nobody can send messages.', u: '/lock' },
    { n: 'unlock', d: 'Unlock this channel.', u: '/unlock' },
    { n: 'unban', d: 'Unban a user — pick from the ban list dropdown.', u: '/unban' },
    { n: 'bans', d: 'List every banned user and their ban reason.', u: '/bans' },
    { n: 'user', d: 'One panel for a member — info plus kick, ban, timeout, warn, roles, nickname & DM buttons.', u: '/user member:@user' },
  ]},
  { name: 'Info', emoji: '📊', commands: [
    { n: 'serverinfo', d: 'Detailed server information card with refresh button.', u: '/serverinfo' },
    { n: 'userinfo', d: 'Read-only member information card.', u: '/userinfo [user:@user]' },
    { n: 'roleinfo', d: 'Role details — members list & color preview included.', u: '/roleinfo role:@role' },
    { n: 'channelinfo', d: 'Channel details with quick-action buttons.', u: '/channelinfo [channel:#chan]' },
    { n: 'avatar', d: "Show a member's avatar in full size.", u: '/avatar [user:@user]' },
    { n: 'servericon', d: 'Show the server icon in full size.', u: '/servericon' },
    { n: 'membercount', d: 'Live humans/bots/online breakdown with bar chart & setup.', u: '/membercount' },
    { n: 'botinfo', d: 'Statistics about this bot.', u: '/botinfo' },
    { n: 'stats', d: 'Live server activity stats — members, channels, roles, boosts.', u: '/stats' },
    { n: 'boosts', d: 'Boost status and perks of this server.', u: '/boosts' },
    { n: 'snipe', d: 'Show the last deleted message in this channel.', u: '/snipe' },
    { n: 'editsnipe', d: 'Show the last edited message in this channel.', u: '/editsnipe' },
  ]},
  { name: 'Utility', emoji: '🔧', commands: [
    { n: 'say', d: 'Make the bot say something — pick the channel from a dropdown.', u: '/say message:<text>' },
    { n: 'remind', d: 'Set a reminder — duration from a dropdown, the bot DMs you.', u: '/remind' },
    { n: 'poll', d: 'Create a reaction poll with up to 10 options.', u: '/poll question:<text> [options...]' },
    { n: 'inrole', d: 'List every member that has a role.', u: '/inrole role:@role' },
    { n: 'channelcreate', d: 'Create a channel — type from buttons, name in one field.', u: '/channelcreate' },
    { n: 'rolecreate', d: 'Create a role — name & color, color from a dropdown.', u: '/rolecreate' },
    { n: 'ping', d: 'Bot latency and API latency.', u: '/ping' },
    { n: 'uptime', d: 'How long the bot has been running.', u: '/uptime' },
    { n: 'invite', d: 'Get the bot invite link.', u: '/invite' },
    { n: 'commands', d: 'This command browser.', u: '/commands' },
  ]},
];

function pageEmbed(i) {
  const p = cmdPages[i];
  const embed = new EmbedBuilder()
    .setTitle(`${p.emoji}  ${p.name} Commands`)
    .setColor(colors.main)
    .setFooter({ text: `Page ${i + 1} of ${cmdPages.length} • ${p.commands.length} commands` })
    .setTimestamp();
  p.commands.forEach((c, x) => {
    embed.addFields({ name: `**/${c.n}**`, value: `> ${c.d}\n> \`${c.u}\``, inline: true });
    if ((x + 1) % 3 === 0 && x + 1 !== p.commands.length) {
      embed.addFields({ name: '​', value: '​', inline: false });
    }
  });
  return embed;
}

/* page nav — also a jump dropdown so you can skip straight to a category */
function pageRow(page) {
  const buttons = [];
  if (page > 0) buttons.push(new ButtonBuilder().setCustomId('hp:prev').setLabel('◀ Prev').setStyle(ButtonStyle.Primary));
  buttons.push(new ButtonBuilder().setCustomId('hp:close').setLabel('✖ Close').setStyle(ButtonStyle.Danger));
  if (page < cmdPages.length - 1) buttons.push(new ButtonBuilder().setCustomId('hp:next').setLabel('Next ▶').setStyle(ButtonStyle.Success));
  const jump = new StringSelectMenuBuilder().setCustomId('hp:jump').setPlaceholder('🔎 Jump to category…')
    .addOptions(cmdPages.map((p, x) => ({ label: `${p.name} (${p.commands.length})`, value: String(x), emoji: p.emoji, default: x === page })));
  return [row(jump), row(...buttons)];
}

/* ═══════════════════════════ welcome/goodbye builder data ═══════════════════════════ */
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

/* ═══════════════════════════ announce builder state ═══════════════════════════ */
const annSessions = new Map(); /* userId -> session */
const ANN_COLORS = [
  { label: 'Blurple (default)', hex: '#5865F2' }, { label: 'Green', hex: '#57F287' },
  { label: 'Red (urgent)', hex: '#ED4245' }, { label: 'Yellow (warning)', hex: '#FEE75C' },
  { label: 'Pink', hex: '#EB459E' }, { label: 'Cyan', hex: '#00B0F4' },
];
const ANN_STYLES = {
  standard: { label: '📢 Standard', author: 'Announcement', footer: '📢 Server Announcement' },
  update: { label: '🆕 Update', author: 'Update', footer: "🆕 What's New" },
  event: { label: '🎉 Event', author: 'Event', footer: '🎉 Upcoming Event' },
  warning: { label: '⚠️ Warning', author: 'Warning', footer: '⚠️ Important Notice' },
  maintenance: { label: '🔧 Maintenance', author: 'Maintenance', footer: '🔧 Scheduled Work' },
};
const ANN_TEMPLATES = [
  { label: '📢 Standard news', title: '📢 Announcement', body: 'We have some exciting news to share!\n\nStay tuned for more information.' },
  { label: '🆕 Update changelog', title: '🆕 Update', body: 'A new update just dropped:\n\n• Improvement one\n• Improvement two\n\nLet us know what you think!' },
  { label: '🎉 Event invite', title: '🎉 Event', body: "Join us for a special event!\n\n📅 When: soon\n📍 Where: here\n\nDon't miss it!" },
  { label: '⚠️ Status update', title: '⚠️ Status', body: 'We are aware of an issue and are working on a fix.\n\nThanks for your patience.' },
];
const newAnnSession = () => ({
  channelId: null, ping: 'none', color: '#5865F2', style: 'standard',
  title: '📢 Announcement', body: null, banner: null, timestamp: true, thumbnail: 'bot',
});

function annEmbed(i, s) {
  const st = ANN_STYLES[s.style];
  const e = new EmbedBuilder()
    .setTitle(s.title)
    .setDescription(s.body ?? '*Click ✍️ Write Message to add the announcement text.*')
    .setColor(parseInt(s.color.replace('#', ''), 16) || colors.main)
    .setAuthor({ name: `${st.author} • ${i.user.username}`, iconURL: i.user.displayAvatarURL() })
    .setFooter({ text: st.footer });
  if (s.timestamp) e.setTimestamp();
  if (s.thumbnail === 'bot') e.setThumbnail(i.client.user.displayAvatarURL());
  if (s.thumbnail === 'server' && i.guild.iconURL()) e.setThumbnail(i.guild.iconURL());
  if (s.banner) e.setImage(s.banner);
  return e;
}

function annPanel(s) {
  const pingLabel = { everyone: '📣 @everyone', here: '📣 @here', none: '🔕 No ping', role: '🏷️ Role ping' };
  return [
    row(
      new ButtonBuilder().setCustomId('ann:title').setLabel('Title').setEmoji('🏷️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ann:body').setLabel(s.body ? '✅ Message Written' : '✍️ Write Message').setStyle(s.body ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ann:banner').setLabel('Banner').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:timestamp').setLabel(`Timestamp: ${s.timestamp ? 'On' : 'Off'}`).setEmoji('🕒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:thumb').setLabel(`Thumbnail: ${s.thumbnail}`).setEmoji('👤').setStyle(ButtonStyle.Secondary),
    ),
    row(menu('ann:color', '🎨 Pick a color…',
      ANN_COLORS.map(c => ({ label: c.label, value: c.hex, emoji: '🎨', default: c.hex === s.color })))),
    row(menu('ann:ping', '📣 Who gets pinged…',
      ['everyone', 'here', 'none', 'role'].map(p => ({ label: pingLabel[p], value: p, default: s.ping === p })))),
    row(
      new ButtonBuilder().setCustomId('ann:send').setLabel('Send').setEmoji('🚀').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ann:test').setLabel('Preview Here').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function annChannelRow(i, s) {
  return row(menu('ann:channel', '📺 Pick the announcement channel…',
    textChannels(i).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: c.id === s.channelId }))));
}

/* /user panel — member info + every per-member moderation action in one place */
function userEmbed(member, g) {
  const warns = g.warns?.[member.id] ?? [];
  const timedOut = member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now();
  return new EmbedBuilder()
    .setTitle(`👤 ${member.user.username}`)
    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
    .setColor(member.displayColor || colors.main)
    .addFields(
      { name: '🆔 ID', value: member.id, inline: true },
      { name: '🤖 Bot', value: member.user.bot ? 'Yes' : 'No', inline: true },
      { name: '📅 Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '📥 Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: '⚠️ Warnings', value: `${warns.length}`, inline: true },
      { name: '🔇 Timed out', value: timedOut ? `until <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>` : 'No', inline: true },
      { name: '🎭 Roles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(' ').slice(0, 1024) || '*none*' },
    )
    .setFooter({ text: 'Moderation panel — use the buttons below' });
}

function userRows(member) {
  const timedOut = member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now();
  return [
    row(
      new ButtonBuilder().setCustomId('usr:kick').setLabel('Kick').setEmoji('👢').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('usr:ban').setLabel('Ban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('usr:timeout').setLabel(timedOut ? 'Remove Timeout' : 'Timeout').setEmoji(timedOut ? '🔊' : '🔇').setStyle(timedOut ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('usr:warn').setLabel('Warn').setEmoji('⚠️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('usr:warnings').setLabel('Warnings').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('usr:clearwarnings').setLabel('Clear Warnings').setEmoji('🧽').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:roleAdd').setLabel('Add Role').setEmoji('➕').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:roleRemove').setLabel('Remove Role').setEmoji('➖').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:nickname').setLabel('Nickname').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:dm').setLabel('DM').setEmoji('📨').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('usr:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* ═══════════════════════════ COMMANDS ═══════════════════════════ */
const commands = [

  /* ─────────────── /commands ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('commands')
      .setDescription('📋 Browse every command — descriptions, usage, categories & pages'),
    ns: 'hp',
    run: (i) => i.reply({ embeds: [pageEmbed(0)], components: pageRow(0), ephemeral: true }),
    async onButton(i) {
      const action = i.customId.split(':')[1];
      if (action === 'close') return i.update({ content: '✖️ Closed.', embeds: [], components: [] });
      const current = parseInt((i.message.embeds[0]?.footer?.text ?? '').match(/^Page (\d+)/)?.[1] ?? 1, 10) - 1;
      const page = Math.max(0, Math.min(cmdPages.length - 1, action === 'prev' ? current - 1 : current + 1));
      return i.update({ embeds: [pageEmbed(page)], components: pageRow(page) });
    },
    async onSelect(i) {
      if (i.customId !== 'hp:jump') return;
      return i.update({ embeds: [pageEmbed(parseInt(i.values[0], 10))], components: pageRow(parseInt(i.values[0], 10)) });
    },
  },

  /* ─────────────── /welcome — full button builder ─────────────── */
  {
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
          Object.entries(MSG_TEMPLATES).filter(([k]) => !k.startsWith('🚪'))
            .map(([k, name]) => ({ label: name, value: k.slice(0, 100), emoji: '📝' })))),
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
          .setDescription(`**Status:** ${s.enabled ? '✅ Enabled' : '❌ Disabled'}${s.channelId ? `\n**Channel:** <#${s.channelId}>` : '\n**Channel:** *pick one below*'}`),
      ];
    },
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.welcome ??= msgDefaults('welcome');
      ctx.save();
      return i.reply({ embeds: this.embed(i, g), components: this.panel(i, g), ephemeral: true });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.welcome ??= msgDefaults('welcome');
      const action = i.customId.split(':')[1];
      if (action === 'toggle') g.welcome.enabled = !g.welcome.enabled;
      if (action === 'avatar') g.welcome.showAvatar = !g.welcome.showAvatar;
      if (action === 'count') g.welcome.showMemberCount = !g.welcome.showMemberCount;
      if (action === 'dm') g.welcome.dmUser = !g.welcome.dmUser;
      if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }
      ctx.save();
      return i.update({ embeds: this.embed(i, g), components: this.panel(i, g) });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.welcome ??= msgDefaults('welcome');
      if (i.customId === 'wlcm:template') {
        const [title, message] = i.values[0].split('|');
        g.welcome.title = title;
        g.welcome.message = message;
        if (g.welcome.showMemberCount && !g.welcome.message.includes('#{membercount}')) g.welcome.message += '\nYou are member #{membercount}.';
      }
      if (i.customId === 'wlcm:color') g.welcome.color = i.values[0];
      if (i.customId === 'wlcm:channel') g.welcome.channelId = i.values[0];
      ctx.save();
      return i.update({ embeds: this.embed(i, g), components: this.panel(i, g) });
    },
  },

  /* ─────────────── /goodbye — same builder pattern ─────────────── */
  {
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
          Object.entries(MSG_TEMPLATES).filter(([k]) => k.startsWith('🚪'))
            .map(([k, name]) => ({ label: name, value: k.slice(0, 100), emoji: '📝' })))),
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
      g.goodbye ??= msgDefaults('goodbye');
      ctx.save();
      return i.reply({ embeds: this.embed(i, g.goodbye), components: this.panel(i, g.goodbye), ephemeral: true });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.goodbye ??= msgDefaults('goodbye');
      const action = i.customId.split(':')[1];
      if (action === 'toggle') g.goodbye.enabled = !g.goodbye.enabled;
      if (action === 'avatar') g.goodbye.showAvatar = !g.goodbye.showAvatar;
      if (action === 'count') g.goodbye.showMemberCount = !g.goodbye.showMemberCount;
      if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }
      ctx.save();
      return i.update({ embeds: this.embed(i, g.goodbye), components: this.panel(i, g.goodbye) });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.goodbye ??= msgDefaults('goodbye');
      if (i.customId === 'gbye:template') {
        const [title, message] = i.values[0].split('|');
        g.goodbye.title = title;
        g.goodbye.message = message;
      }
      if (i.customId === 'gbye:color') g.goodbye.color = i.values[0];
      if (i.customId === 'gbye:channel') g.goodbye.channelId = i.values[0];
      ctx.save();
      return i.update({ embeds: this.embed(i, g.goodbye), components: this.panel(i, g.goodbye) });
    },
  },

  /* ─────────────── /announce — visual announcement builder ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('📢 Build a polished announcement with a live visual editor')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    ns: 'ann',
    async run(i) {
      const s = newAnnSession();
      s.channelId = i.channelId;
      annSessions.set(i.user.id, s);
      return i.reply({
        embeds: [annEmbed(i, s),
          new EmbedBuilder().setTitle('📢 Announcement Builder').setColor(colors.main)
            .setDescription('Build your announcement live — every change shows in the preview above.\n1️⃣ Pick the **channel** below\n2️⃣ Pick **ping**, **color** and optionally a **template**\n3️⃣ Click **✍️ Write Message** to add your text\n4️⃣ Hit **🚀 Send**')],
        components: [annChannelRow(i, s), ...annPanel(s)],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      const s = annSessions.get(i.user.id);
      if (!s) return err(i, 'This builder expired — run `/announce` again.');
      const action = i.customId.split(':')[1];

      if (action === 'title') {
        const modal = new ModalBuilder().setCustomId('ann:titleModal').setTitle('Announcement Title');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('v').setLabel('Title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(s.title).setRequired(true)));
        return i.showModal(modal);
      }
      if (action === 'body') {
        const modal = new ModalBuilder().setCustomId('ann:bodyModal').setTitle('Announcement Message');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('v').setLabel('Message (markdown supported)').setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setValue(s.body ?? '').setRequired(true)));
        return i.showModal(modal);
      }
      if (action === 'banner') {
        const modal = new ModalBuilder().setCustomId('ann:bannerModal').setTitle('Banner Image');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('v').setLabel('Image URL (leave blank to remove)').setStyle(TextInputStyle.Short).setValue(s.banner ?? '').setRequired(false)));
        return i.showModal(modal);
      }
      if (action === 'timestamp') { s.timestamp = !s.timestamp; return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] }); }
      if (action === 'thumb') { s.thumbnail = { bot: 'server', server: 'none', none: 'bot' }[s.thumbnail]; return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] }); }
      if (action === 'cancel') { annSessions.delete(i.user.id); return i.update({ content: '✖️ Announcement cancelled.', embeds: [], components: [] }); }

      if (action === 'test') {
        await i.channel.send({ embeds: [annEmbed(i, s)], content: s.ping === 'everyone' ? '@everyone' : s.ping === 'here' ? '@here' : undefined });
        return i.reply({ content: '👁️ Preview posted in this channel (pings are real — preview in a quiet channel!).', ephemeral: true });
      }
      if (action === 'send') {
        const ch = await i.guild.channels.fetch(s.channelId).catch(() => null);
        if (!ch) return err(i, 'Pick a valid channel first.');
        const content = s.ping === 'role' ? (s.roleMention ?? '')
          : s.ping === 'everyone' ? '@everyone' : s.ping === 'here' ? '@here' : undefined;
        await ch.send({ content, embeds: [annEmbed(i, s)] }).catch(() => {});
        annSessions.delete(i.user.id);
        return i.update({ content: `🚀 Announcement sent in ${ch}.`, embeds: [], components: [] });
      }
    },
    async onSelect(i, ctx) {
      const s = annSessions.get(i.user.id);
      if (!s) return err(i, 'This builder expired — run `/announce` again.');
      if (i.customId === 'ann:channel') s.channelId = i.values[0];
      if (i.customId === 'ann:color') s.color = i.values[0];
      if (i.customId === 'ann:ping') {
        s.ping = i.values[0];
        if (s.ping === 'role') {
          const roleSel = new StringSelectMenuBuilder().setCustomId('ann:rolePing').setPlaceholder('🏷️ Pick the role to ping…')
            .addOptions(i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25)
              .map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🏷️' })));
          return i.update({ components: [annChannelRow(i, s), row(roleSel), ...annPanel(s).slice(1)] });
        }
      }
      if (i.customId === 'ann:rolePing') s.roleMention = `<@&${i.values[0]}>`;
      if (i.customId === 'ann:template') {
        const t = ANN_TEMPLATES.find(t => t.label === i.values[0]);
        if (t) { s.title = t.title; s.body = t.body; }
      }
      return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] });
    },
    async onModal(i, ctx) {
      const s = annSessions.get(i.user.id);
      if (!s) return err(i, 'This builder expired — run `/announce` again.');
      const v = i.fields.getTextInputValue('v');
      if (i.customId === 'ann:titleModal') s.title = v;
      if (i.customId === 'ann:bodyModal') s.body = v;
      if (i.customId === 'ann:bannerModal') s.banner = v.trim() || null;
      return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] });
    },
  },

  /* ─────────────── /jointocreate — dropdown setup ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('jointocreate')
      .setDescription('🔊 Set up Join-to-Create voice lobbies — dropdown setup')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    ns: 'jtc',
    panel(i, g) {
      const jtc = g.jtc ?? {};
      const lobbies = voiceChannels(i);
      const cats = categories(i);
      const rows = [];
      if (lobbies.length) rows.push(row(menu('jtc:lobby', '🎙️ Pick the lobby voice channel…',
        lobbies.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '🎙️', default: jtc?.lobbyId === c.id })))));
      if (cats.length) rows.push(row(menu('jtc:category', '📁 Pick the category for new channels…',
        cats.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁', default: jtc?.categoryId === c.id })))));
      rows.push(row(
        new ButtonBuilder().setCustomId('jtc:toggle').setLabel(jtc?.lobbyId && jtc?.categoryId ? (jtc?.enabled ? 'Disable' : 'Enable') : 'Pick Lobby & Category First').setEmoji(jtc?.enabled ? '🔴' : '🟢').setStyle(jtc?.enabled ? ButtonStyle.Danger : ButtonStyle.Success).setDisabled(!(jtc?.lobbyId && jtc?.categoryId)),
        new ButtonBuilder().setCustomId('jtc:limit').setLabel(`Channel Limit: ${jtc?.limit === 0 || jtc?.limit == null ? 'Auto' : jtc?.limit}`).setEmoji('👥').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('jtc:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
      ));
      return rows;
    },
    embed(g) {
      const jtc = g.jtc;
      return new EmbedBuilder().setTitle('🔊 Join-to-Create').setColor(jtc.enabled ? colors.good : colors.main)
        .setDescription(`**Status:** ${jtc.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Lobby:** ${jtc.lobbyId ? `<#${jtc.lobbyId}>` : '*pick below*'}\n**Category:** ${jtc.categoryId ? `<#${jtc.categoryId}>` : '*pick below*'}\n**Limit:** ${jtc.limit || 'Auto'}\n\nWhen someone joins the lobby channel, they get their own private voice channel.`);
    },
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.jtc ??= { enabled: false, lobbyId: null, categoryId: null, limit: 0 };
      ctx.save();
      return i.reply({ embeds: [this.embed(g)], components: this.panel(i, g), ephemeral: true });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.jtc ??= { enabled: false, lobbyId: null, categoryId: null, limit: 0 };
      const action = i.customId.split(':')[1];
      if (action === 'toggle') g.jtc.enabled = !g.jtc.enabled;
      if (action === 'limit') g.jtc.limit = g.jtc.limit >= 99 ? 0 : (g.jtc.limit ? g.jtc.limit + 5 : 2);
      if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }
      ctx.save();
      return i.update({ embeds: [this.embed(g)], components: this.panel(i, g) });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.jtc ??= { enabled: false, lobbyId: null, categoryId: null, limit: 0 };
      if (i.customId === 'jtc:lobby') g.jtc.lobbyId = i.values[0];
      if (i.customId === 'jtc:category') g.jtc.categoryId = i.values[0];
      ctx.save();
      return i.update({ embeds: [this.embed(g)], components: this.panel(i, g) });
    },
  },

  /* ─────────────── /autorole — multi-select dropdown ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('autorole')
      .setDescription('🏷️ Roles automatically given when members join — multi-select')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    ns: 'arole',
    buildMenu(i, g) {
      g.autoroles ??= [];
      return new StringSelectMenuBuilder().setCustomId('arole:pick').setPlaceholder('🏷️ Select autoroles (multiple allowed)…')
        .setMinValues(0).setMaxValues(25)
        .addOptions(rolesMenu(i).map(r => ({ ...r, default: g.autoroles.includes(r.value) })));
    },
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.autoroles ??= [];
      return i.reply({
        embeds: [new EmbedBuilder().setTitle('🏷️ Autoroles').setColor(colors.main)
          .setDescription(`Roles given automatically on join:\n${g.autoroles.map(r => `<@&${r}>`).join(' ') || '*none — select from the dropdown*\n\n✅ Selections save instantly — whatever is highlighted in the menu is active.'}`)],
        components: [row(this.buildMenu(i, g))],
        ephemeral: true,
      });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.autoroles = i.values;
      ctx.save();
      return i.update({
        embeds: [new EmbedBuilder().setTitle('🏷️ Autoroles').setColor(colors.good)
          .setDescription(`✅ Saved — roles given on join:\n${g.autoroles.map(r => `<@&${r}>`).join(' ') || '*none*'}`)],
        components: [row(this.buildMenu(i, g))],
      });
    },
  },

  /* ─────────────── /selfroles ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('selfroles')
      .setDescription('🎫 Roles members can give themselves — multi-select admin panel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    ns: 'srole',
    buildMenu(i, g) {
      g.selfroles ??= [];
      return new StringSelectMenuBuilder().setCustomId('srole:manage').setPlaceholder('🎫 Select available selfroles…')
        .setMinValues(0).setMaxValues(25)
        .addOptions(rolesMenu(i).map(r => ({ ...r, default: g.selfroles.includes(r.value) })));
    },
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.selfroles ??= [];
      return i.reply({
        embeds: [new EmbedBuilder().setTitle('🎫 Selfroles — Admin Panel').setColor(colors.main)
          .setDescription(`Roles members can pick:\n${g.selfroles.map(r => `<@&${r}>`).join(' ') || '*none — select below*'}\n\n✅ Saves instantly. Members use the public panel posted with the button below.`)],
        components: [row(this.buildMenu(i, g)), row(new ButtonBuilder().setCustomId('srole:post').setLabel('Post Public Panel').setEmoji('📌').setStyle(ButtonStyle.Success))],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.selfroles ??= [];
      if (!g.selfroles.length) return err(i, 'Select at least one selfrole first.');
      const menu = new StringSelectMenuBuilder().setCustomId('srole:pick').setPlaceholder('🎫 Choose your roles…')
        .setMinValues(0).setMaxValues(g.selfroles.length)
        .addOptions(g.selfroles.map(r => ({ label: (i.guild.roles.cache.get(r)?.name ?? r).slice(0, 100), value: r, emoji: '🎫' })));
      await i.channel.send({
        embeds: [new EmbedBuilder().setTitle('🎫 Pick Your Roles').setColor(colors.main)
          .setDescription('Select your roles from the menu below.\n**Available:** ' + g.selfroles.map(r => `<@&${r}>`).join(' '))],
        components: [row(menu)],
      });
      return i.reply({ content: '✅ Public panel posted.', ephemeral: true });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      if (i.customId === 'srole:manage') {
        g.selfroles = i.values;
        ctx.save();
        return i.update({
          embeds: [new EmbedBuilder().setTitle('🎫 Selfroles — Admin Panel').setColor(colors.good)
            .setDescription(`✅ Saved. Members can pick:\n${g.selfroles.map(r => `<@&${r}>`).join(' ') || '*none*'}`)],
          components: [row(this.buildMenu(i, g)), row(new ButtonBuilder().setCustomId('srole:post').setLabel('Post Public Panel').setEmoji('📌').setStyle(ButtonStyle.Success))],
        });
      }
      if (i.customId === 'srole:pick') {
        g.selfroles ??= [];
        await i.member.roles.remove(g.selfroles.filter(r => !i.values.includes(r))).catch(() => {});
        await i.member.roles.add(i.values).catch(() => {});
        return i.update({ content: `✅ Your roles: ${i.values.map(r => `<@&${r}>`).join(' ') || '*none*'}`, components: [i.message.components[0]] });
      }
    },
  },

  /* ─────────────── /ticket — dropdown setup + post ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('🎫 Post a support ticket panel — dropdown setup')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    ns: 'tkt',
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      return i.reply({
        embeds: [new EmbedBuilder().setTitle('🎫 Ticket Setup').setColor(colors.main)
          .setDescription(`**Ticket category:** pick below\n**Current:** ${g.ticketCategoryId ? `<#${g.ticketCategoryId}>` : '*not set*'}`)],
        components: [
          row(menu('tkt:cat', '📁 Category tickets open in…',
            categories(i).map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁', default: c.id === g.ticketCategoryId })))),
          row(new ButtonBuilder().setCustomId('tkt:post').setLabel('Post Panel').setEmoji('📌').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tkt:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary)),
        ],
        ephemeral: true,
      });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      if (i.customId === 'tkt:cat') { g.ticketCategoryId = i.values[0]; ctx.save(); }
      return i.update({ content: `📁 Tickets will open in **${i.guild.channels.cache.get(i.values[0])?.name}**.` });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      const action = i.customId.split(':')[1];

      /* ticket channel close buttons (inside a ticket channel) */
      if (action === 'close' && i.channel?.topic?.startsWith('ticket:')) {
        return i.reply({
          content: '⚠️ Close this ticket?',
          components: [row(
            new ButtonBuilder().setCustomId('tkt:closeConfirm').setLabel('✅ Confirm Close').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tkt:closeCancel').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
          )],
          ephemeral: true,
        });
      }
      if (action === 'closeCancel') return i.update({ content: 'Ticket stays open.', components: [] });
      if (action === 'closeConfirm') {
        await i.update({ content: '🔒 Closing…', components: [] });
        return setTimeout(() => i.channel?.delete().catch(() => {}), 3000);
      }

      /* setup panel buttons */
      if (action === 'post') {
        const panel = await i.channel.send({
          embeds: [new EmbedBuilder().setTitle('🎫 Support Tickets').setColor(colors.main)
            .setDescription('Need help? Click the button below to open a private ticket with the staff team.')],
          components: [row(new ButtonBuilder().setCustomId('tkt:open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary))],
        }).catch(() => null);
        if (!panel) return err(i, "I couldn't post the panel here.");
        return i.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
      }
      if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }

      if (action === 'open') {
        const existing = i.guild.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
        if (existing) return err(i, `You already have a ticket: ${existing}`);
        const ch = await i.guild.channels.create({
          name: `🎫-${i.user.username}`,
          type: ChannelType.GuildText,
          parent: g.ticketCategoryId ?? null,
          topic: `ticket:${i.user.id}`,
          permissionOverwrites: [
            { id: i.guild.id, deny: ['ViewChannel'] },
            { id: i.user.id, allow: ['ViewChannel', 'SendMessages'] },
          ],
        }).catch(() => null);
        if (!ch) return err(i, 'I need **Manage Channels** to open tickets.');
        await ch.send({
          content: `${i.user} — describe your issue and staff will be with you shortly.`,
          components: [row(new ButtonBuilder().setCustomId('tkt:close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger))],
        });
        return i.reply({ content: `✅ Your ticket: ${ch}`, ephemeral: true });
      }
    },
  },

  /* ─────────────── /logs — dropdown picker ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('logs')
      .setDescription('📜 Set the error log channel — dropdown picker')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    ns: 'logs',
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      const chans = textChannels(i);
      const sel = new StringSelectMenuBuilder().setCustomId('logs:pick').setPlaceholder('📜 Pick the error log channel…')
        .addOptions(
          { label: 'Disable error logging', value: 'off', emoji: '❌' },
          ...chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜', default: c.id === g.logsChannelId })),
        );
      return i.reply({
        embeds: [new EmbedBuilder().setTitle('📜 Error Logs').setColor(colors.main)
          .setDescription(`Current: ${g.logsChannelId ? `<#${g.logsChannelId}>` : '*disabled*'}\n\nErrors will appear with codes like \`ERR-7F3A2B\`.`)],
        components: [row(sel)],
        ephemeral: true,
      });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      g.logsChannelId = i.values[0] === 'off' ? null : i.values[0];
      ctx.save();
      return i.update({ content: g.logsChannelId ? `📜 Errors will be logged in <#${g.logsChannelId}>.` : '📜 Error logging disabled.', components: [] });
    },
  },

  /* ─────────────── /refresh ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('refresh')
      .setDescription('🔄 Re-register slash commands instantly (admin)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async run(i) {
      await i.guild.commands.set(commands.map(c => c.data.toJSON()));
      return i.reply({ content: `✅ Registered **${commands.length}** commands in this server. They appear instantly.`, ephemeral: true });
    },
  },

  /* ─────────────── MODERATION ─────────────── */

  /* /purge — dropdown amount */
  {
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('🧹 Bulk delete messages — pick the amount from a dropdown')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addUserOption(o => o.setName('user').setDescription('Only delete from this user')),
    ns: 'prg',
    async run(i) {
      await i.deferReply({ ephemeral: true });
      const user = i.options.getUser('user');
      const sel = new StringSelectMenuBuilder().setCustomId('prg:amount').setPlaceholder('🧹 How many messages to delete…')
        .addOptions([5, 10, 25, 50, 100].map(n => ({ label: `Delete ${n} messages`, value: String(n), emoji: '🗑️' })));
      await i.editReply({ content: user ? `🗑️ Deleting from **${user.username}** — pick an amount:` : '🗑️ Pick an amount to delete:', components: [row(sel)] });
      i.client.purgeUsers ??= new Map();
      i.client.purgeUsers.set(i.user.id, user?.id ?? null);
    },
    async onSelect(i) {
      const userId = i.client.purgeUsers?.get(i.user.id) ?? null;
      const amount = parseInt(i.values[0], 10);
      await i.deferUpdate();
      const msgs = await i.channel.messages.fetch({ limit: 100 });
      const target = userId ? [...msgs.values()].filter(m => m.author.id === userId).slice(0, amount) : [...msgs.values()].slice(0, amount);
      await i.channel.bulkDelete(target, true).catch(() => {});
      return i.editReply({ content: `🗑️ Deleted **${target.length}** message(s).`, components: [] });
    },
  },

  /* /slowmode — dropdown presets */
  {
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
  },

  /* /lock — instant, no typing */
  {
    data: new SlashCommandBuilder().setName('lock').setDescription('🔒 Lock this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async run(i) {
      await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: false });
      return i.reply({ embeds: [new EmbedBuilder().setTitle('🔒 Channel Locked').setDescription('Only staff can send messages now.').setColor(colors.bad)
        .addFields({ name: 'Unlock', value: 'Use `/unlock` when ready.' })] });
    },
  },

  /* /unlock */
  {
    data: new SlashCommandBuilder().setName('unlock').setDescription('🔓 Unlock this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async run(i) {
      await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: null });
      return i.reply({ embeds: [new EmbedBuilder().setTitle('🔓 Channel Unlocked').setDescription('Everyone can send messages again.').setColor(colors.good)] });
    },
  },

  /* /user — one panel for every per-member moderation action */
  {
    data: new SlashCommandBuilder()
      .setName('user')
      .setDescription('👤 View a member and moderate them from one panel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('member').setDescription('Member to inspect').setRequired(true)),
    ns: 'usr',
    async run(i, ctx) {
      const member = i.options.getMember('member');
      if (!member) return err(i, 'That user is not in this server.');
      i.client.userPanels ??= new Map();
      i.client.userPanels.set(i.user.id, member.id);
      const g = ctx.guild(i.guildId);
      return i.reply({ embeds: [userEmbed(member, g)], components: userRows(member), ephemeral: true });
    },
    async onButton(i, ctx) {
      const memberId = i.client.userPanels?.get(i.user.id);
      const member = memberId && await i.guild.members.fetch(memberId).catch(() => null);
      if (!member) return err(i, 'Session expired — run `/user` again.');
      const g = ctx.guild(i.guildId);
      const action = i.customId.split(':')[1];

      if (action === 'refresh') return i.update({ embeds: [userEmbed(member, g)], components: userRows(member) });
      if (action === 'close') return i.update({ content: '✖️ Closed.', embeds: [], components: [] });

      if (action === 'kick') {
        if (!i.member.permissions.has(PermissionFlagsBits.KickMembers)) return err(i, 'You need the **Kick Members** permission.');
        if (!member.kickable) return err(i, "I can't kick that member — they outrank me.");
        return i.reply({
          content: `👢 Kicking **${member.user.username}** — pick a reason:`,
          components: [row(menu('usr:kickReason', '👢 Pick a reason…', [
            { label: 'No reason given', value: 'No reason given', emoji: '👢' },
            { label: 'Breaking server rules', value: 'Breaking server rules', emoji: '📜' },
            { label: 'Spamming', value: 'Spamming', emoji: '📢' },
            { label: 'Toxic behavior', value: 'Toxic behavior', emoji: '☠️' },
            { label: 'Inappropriate content', value: 'Inappropriate content', emoji: '🚫' },
            { label: 'Suspected alt/raid account', value: 'Suspected alt/raid account', emoji: '🎭' },
            { label: 'Requested by user', value: 'Requested by user', emoji: '🙏' },
          ]))],
          ephemeral: true,
        });
      }

      if (action === 'ban') {
        if (!i.member.permissions.has(PermissionFlagsBits.BanMembers)) return err(i, 'You need the **Ban Members** permission.');
        if (!member.bannable) return err(i, "I can't ban that member — they outrank me.");
        i.client.userBan ??= new Map();
        i.client.userBan.set(i.user.id, { reason: 'No reason given', days: 0 });
        return i.reply({
          content: `🔨 Banning **${member.user.username}** — configure, then confirm:`,
          components: [
            row(menu('usr:banReason', '🔨 Pick a reason…', [
              { label: 'No reason given', value: 'No reason given', emoji: '🔨' },
              { label: 'Breaking server rules', value: 'Breaking server rules', emoji: '📜' },
              { label: 'Spamming / advertising', value: 'Spamming / advertising', emoji: '📢' },
              { label: 'Raiding the server', value: 'Raiding the server', emoji: '⚔️' },
              { label: 'Scam / phishing links', value: 'Scam / phishing links', emoji: '🎣' },
              { label: 'Toxic behavior', value: 'Toxic behavior', emoji: '☠️' },
              { label: 'Suspected alt/raid account', value: 'Suspected alt/raid account', emoji: '🎭' },
            ])),
            row(menu('usr:banDays', '🧹 Delete their messages from…', [
              { label: "Don't delete messages", value: '0', emoji: '🚫' },
              { label: 'Last 24 hours', value: '1', emoji: '📅' },
              { label: 'Last 3 days', value: '3', emoji: '📅' },
              { label: 'Last 7 days', value: '7', emoji: '📅' },
            ])),
            row(
              new ButtonBuilder().setCustomId('usr:banConfirm').setLabel('✅ Confirm Ban').setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('usr:banCancel').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
            ),
          ],
          ephemeral: true,
        });
      }
      if (action === 'banCancel') { i.client.userBan?.delete(i.user.id); return i.update({ content: '✖️ Ban cancelled.', components: [] }); }
      if (action === 'banConfirm') {
        const s = i.client.userBan?.get(i.user.id);
        if (!s) return err(i, 'Session expired — click Ban again.');
        await i.guild.members.ban(member.id, { reason: `[by ${i.user.tag}] ${s.reason}`, deleteMessageSeconds: s.days * 86400 }).catch(() => {});
        i.client.userBan.delete(i.user.id);
        return i.update({ content: `🔨 Banned ${member.user} — *${s.reason}*${s.days ? ` (messages from last ${s.days}d deleted)` : ''}`, components: [] });
      }

      if (action === 'timeout') {
        if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
        const timedOut = member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now();
        if (timedOut) {
          await member.timeout(null);
          return i.update({ embeds: [userEmbed(member, g)], components: userRows(member) });
        }
        if (!member.moderatable) return err(i, "I can't timeout that member.");
        return i.reply({
          content: `🔇 Timing out **${member.user.username}** — pick a duration:`,
          components: [row(menu('usr:timeoutDur', '🔇 Pick a duration…', [
            { label: '60 seconds', value: '60', emoji: '⏱️' },
            { label: '10 minutes', value: '600', emoji: '⏱️' },
            { label: '1 hour', value: '3600', emoji: '🕐' },
            { label: '1 day', value: '86400', emoji: '📅' },
            { label: '1 week', value: '604800', emoji: '📅' },
          ]))],
          ephemeral: true,
        });
      }

      if (action === 'warn') {
        if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
        return i.reply({
          content: `⚠️ Warning **${member.user.username}** — pick a reason:`,
          components: [row(menu('usr:warnReason', '⚠️ Pick a reason…', [
            { label: 'Breaking server rules', value: 'Breaking server rules', emoji: '📜' },
            { label: 'Spamming', value: 'Spamming', emoji: '📢' },
            { label: 'Toxic behavior', value: 'Toxic behavior', emoji: '☠️' },
            { label: 'Inappropriate content', value: 'Inappropriate content', emoji: '🚫' },
            { label: 'Advertising', value: 'Advertising', emoji: '📣' },
            { label: 'Harassment', value: 'Harassment', emoji: '😤' },
            { label: 'Final warning (any reason)', value: 'Final warning', emoji: '🚨' },
          ]))],
          ephemeral: true,
        });
      }

      if (action === 'warnings') {
        const list = g.warns?.[member.id] ?? [];
        if (!list.length) return i.reply({ content: `✅ ${member.user} has no warnings.`, ephemeral: true });
        return i.reply({
          embeds: [new EmbedBuilder()
            .setTitle(`📋 Warnings — ${member.user.username} (${list.length})`)
            .setDescription(list.map((w, x) => `**${x + 1}.** ${w.reason} — <@${w.by}> <t:${Math.floor(w.at / 1000)}:R>`).join('\n'))
            .setColor(colors.warn)],
          ephemeral: true,
        });
      }

      if (action === 'clearwarnings') {
        if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
        if (g.warns) delete g.warns[member.id];
        ctx.save();
        return i.update({ embeds: [userEmbed(member, g)], components: userRows(member) });
      }

      if (action === 'roleAdd') {
        if (!i.member.permissions.has(PermissionFlagsBits.ManageRoles)) return err(i, 'You need the **Manage Roles** permission.');
        return i.reply({ content: `➕ Pick a role to give ${member.user}:`, components: [row(menu('usr:roleAddSel', '🏷️ Pick a role…', rolesMenu(i)))], ephemeral: true });
      }
      if (action === 'roleRemove') {
        if (!i.member.permissions.has(PermissionFlagsBits.ManageRoles)) return err(i, 'You need the **Manage Roles** permission.');
        const options = member.roles.cache.filter(r => r.id !== i.guild.id).first(25).map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🏷️' }));
        if (!options.length) return err(i, `${member.user} has no removable roles.`);
        return i.reply({ content: `➖ Pick a role to remove from ${member.user}:`, components: [row(menu('usr:roleRemoveSel', '🏷️ Pick a role…', options))], ephemeral: true });
      }

      if (action === 'nickname') {
        if (!i.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return err(i, 'You need the **Manage Nicknames** permission.');
        const modal = new ModalBuilder().setCustomId('usr:nickModal').setTitle('Change Nickname');
        modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('New nickname (blank = reset)').setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(false)));
        return i.showModal(modal);
      }
      if (action === 'dm') {
        if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
        const modal = new ModalBuilder().setCustomId('usr:dmModal').setTitle('Send DM');
        modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Message').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)));
        return i.showModal(modal);
      }
    },
    async onSelect(i, ctx) {
      const memberId = i.client.userPanels?.get(i.user.id);
      const member = memberId && await i.guild.members.fetch(memberId).catch(() => null);
      if (!member) return err(i, 'Session expired — run `/user` again.');
      const g = ctx.guild(i.guildId);

      if (i.customId === 'usr:kickReason') {
        const reason = i.values[0];
        await member.send(`You were kicked from **${i.guild.name}**. Reason: ${reason}`).catch(() => {});
        await member.kick(`[by ${i.user.tag}] ${reason}`);
        return i.update({ content: `👢 Kicked ${member.user} — *${reason}*`, components: [] });
      }

      if (i.customId === 'usr:banReason' || i.customId === 'usr:banDays') {
        const s = i.client.userBan?.get(i.user.id);
        if (!s) return err(i, 'Session expired — click Ban again.');
        if (i.customId === 'usr:banReason') s.reason = i.values[0];
        else s.days = parseInt(i.values[0], 10);
        return i.update({ content: `🔨 Banning — Reason: *${s.reason}* • Message wipe: **${s.days ? `${s.days} day(s)` : 'none'}**\nClick ✅ Confirm when ready.` });
      }

      if (i.customId === 'usr:timeoutDur') {
        const seconds = parseInt(i.values[0], 10);
        if (!member.moderatable) return err(i, "I can't timeout that member.");
        await member.timeout(seconds * 1000, `[by ${i.user.tag}]`);
        return i.update({ content: `🔇 ${member.user} timed out for **${seconds < 3600 ? `${seconds / 60} min` : seconds / 3600 < 24 ? `${seconds / 3600} hr` : `${seconds / 86400} day(s)`}**.`, components: [] });
      }

      if (i.customId === 'usr:warnReason') {
        const reason = i.values[0];
        g.warns ??= {};
        g.warns[member.id] ??= [];
        g.warns[member.id].push({ by: i.user.id, reason, at: Date.now() });
        ctx.save();
        await member.send(`⚠️ You were warned in **${i.guild.name}**: ${reason}`).catch(() => {});
        return i.update({ content: `⚠️ Warned ${member.user} — *${reason}* (they now have **${g.warns[member.id].length}** warning(s)).`, components: [] });
      }

      if (i.customId === 'usr:roleAddSel' || i.customId === 'usr:roleRemoveSel') {
        const role = await i.guild.roles.fetch(i.values[0]).catch(() => null);
        if (!role || !role.editable) return err(i, "I can't manage that role.");
        if (i.customId === 'usr:roleAddSel') await member.roles.add(role);
        else await member.roles.remove(role);
        return i.update({ content: `${i.customId === 'usr:roleAddSel' ? '➕ Gave' : '➖ Removed'} ${role} ${i.customId === 'usr:roleAddSel' ? 'to' : 'from'} ${member.user}.`, components: [] });
      }
    },
    async onModal(i) {
      const memberId = i.client.userPanels?.get(i.user.id);
      const member = memberId && await i.guild.members.fetch(memberId).catch(() => null);
      if (!member) return err(i, 'Session expired — run `/user` again.');

      if (i.customId === 'usr:nickModal') {
        const nick = i.fields.getTextInputValue('v').trim();
        await member.setNickname(nick || null).catch(() => {});
        return i.reply({ content: nick ? `✏️ Nickname of ${member.user} set to **${nick}**.` : `✏️ Reset ${member.user}'s nickname.`, ephemeral: true });
      }
      if (i.customId === 'usr:dmModal') {
        const sent = await member.send(i.fields.getTextInputValue('v')).catch(() => null);
        return i.reply({ content: sent ? `📨 Sent to ${member.user}.` : "Couldn't DM that user — their DMs may be closed.", ephemeral: true });
      }
    },
  },

  /* ─────────────── INFO ─────────────── */

  /* /serverinfo — with refresh */
  {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('📊 Server information'),
    ns: 'si',
    embed(i) {
      const { guild } = i;
      const e = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 512 }))
        .setColor(colors.main)
        .addFields(
          { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (Level ${guild.premiumTier})`, inline: true },
        )
        .setFooter({ text: `ID: ${guild.id}` })
        .setTimestamp();
      if (guild.bannerURL()) e.setImage(guild.bannerURL({ size: 1024 }));
      return e;
    },
    async run(i) {
      return i.reply({ embeds: [this.embed(i)], components: [row(new ButtonBuilder().setCustomId('si:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary))] });
    },
    async onButton(i) { return i.update({ embeds: [this.embed(i)] }); },
  },

  /* /userinfo — read-only; use /user for moderation actions */
  {
    data: new SlashCommandBuilder().setName('userinfo').setDescription('👤 User information')
      .addUserOption(o => o.setName('user').setDescription('User to inspect')),
    async run(i, ctx) {
      const user = i.options.getUser('user') ?? i.user;
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const g = ctx.guild(i.guildId);
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Info`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .setColor(member?.displayColor || colors.main)
        .addFields(
          { name: '🏷️ Username', value: user.username, inline: true },
          { name: '🆔 ID', value: user.id, inline: true },
          { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
          { name: '📅 Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (member) {
        embed.addFields(
          { name: '📥 Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: '🎭 Roles', value: member.roles.cache.filter(r => r.id !== i.guild.id).map(r => `<@&${r.id}>`).join(' ').slice(0, 1024) || '*none*', inline: false },
          { name: '⚠️ Warnings', value: `${(g.warns?.[user.id] ?? []).length}`, inline: true },
          { name: '🔇 Timed out', value: member.isCommunicationDisabled() ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>` : 'No', inline: true },
        );
      }
      return i.reply({ embeds: [embed] });
    },
  },

  /* /roleinfo — with member count bar */
  {
    data: new SlashCommandBuilder().setName('roleinfo').setDescription('🎭 Role information')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    async run(i) {
      const role = i.options.getRole('role');
      await i.guild.members.fetch().catch(() => {});
      const pct = Math.min(100, Math.round((role.members.size / Math.max(1, i.guild.memberCount)) * 100));
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`🎭 ${role.name}`)
          .setColor(role.color || colors.main)
          .setThumbnail(i.guild.iconURL({ size: 128 }))
          .addFields(
            { name: '🆔 ID', value: role.id, inline: true },
            { name: '🎨 Color', value: role.hexColor, inline: true },
            { name: '👥 Members', value: `${role.members.size} (${pct}% of server)`, inline: true },
            { name: '📍 Position', value: `${role.position}`, inline: true },
            { name: '📌 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: '🤖 Managed', value: role.managed ? 'Yes' : 'No', inline: true },
            { name: 'Coverage', value: `\`${'█'.repeat(Math.round(pct / 10)).padEnd(10, '░')}\` ${pct}%` },
          )],
      });
    },
  },

  /* /channelinfo — with quick actions */
  {
    data: new SlashCommandBuilder().setName('channelinfo').setDescription('📺 Channel information')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)),
    ns: 'ci',
    async run(i) {
      const channel = i.options.getChannel('channel') ?? i.channel;
      const embed = new EmbedBuilder()
        .setTitle(`📺 #${channel.name}`)
        .setColor(colors.main)
        .addFields(
          { name: '🆔 ID', value: channel.id, inline: true },
          { name: '📂 Type', value: channel.type === ChannelType.GuildVoice ? 'Voice' : 'Text', inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '🐢 Slowmode', value: channel.rateLimitPerUser ? `${channel.rateLimitPerUser}s` : 'Off', inline: true },
        );
      if (channel.parent) embed.addFields({ name: '📁 Category', value: channel.parent.name, inline: true });
      if (channel.topic) embed.addFields({ name: '📝 Topic', value: channel.topic.slice(0, 1024) });
      const actions = row(
        new ButtonBuilder().setCustomId(`ci:lock:${channel.id}`).setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ci:unlock:${channel.id}`).setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ci:delete:${channel.id}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );
      return i.reply({ embeds: [embed], components: [actions] });
    },
    async onButton(i) {
      const [, action, id] = i.customId.split(':');
      const ch = await i.guild.channels.fetch(id).catch(() => null);
      if (!ch) return err(i, 'Channel not found.');
      if (action === 'lock') { await ch.permissionOverwrites.edit(i.guild.id, { SendMessages: false }); return i.reply({ content: `🔒 Locked ${ch}.`, ephemeral: true }); }
      if (action === 'unlock') { await ch.permissionOverwrites.edit(i.guild.id, { SendMessages: null }); return i.reply({ content: `🔓 Unlocked ${ch}.`, ephemeral: true }); }
      if (action === 'delete') {
        return i.reply({
          content: `⚠️ Delete ${ch}? This cannot be undone.`,
          components: [row(
            new ButtonBuilder().setCustomId(`ci:delConfirm:${id}`).setLabel('✅ Delete Channel').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ci:delCancel').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
          )],
          ephemeral: true,
        });
      }
      if (action === 'delCancel') return i.update({ content: '✖️ Cancelled.', components: [] });
      if (action === 'delConfirm') {
        await ch.delete(`[by ${i.user.tag}]`).catch(() => {});
        return i.update({ content: '🗑️ Channel deleted.', components: [] });
      }
    },
  },

  /* /avatar */
  {
    data: new SlashCommandBuilder().setName('avatar').setDescription("🖼️ Show a user's avatar")
      .addUserOption(o => o.setName('user').setDescription('User')),
    async run(i) {
      const user = i.options.getUser('user') ?? i.user;
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`${user.username}'s Avatar`)
          .setImage(user.displayAvatarURL({ size: 1024 }))
          .setColor(colors.main)
          .addFields({
            name: 'Links',
            value: `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) • [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 1024 })}) • [WEBP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})`,
          })],
      });
    },
  },

  /* /servericon */
  {
    data: new SlashCommandBuilder().setName('servericon').setDescription('🖼️ Show the server icon'),
    async run(i) {
      if (!i.guild.iconURL()) return err(i, 'This server has no icon.');
      return i.reply({ embeds: [new EmbedBuilder().setTitle(`${i.guild.name}'s Icon`).setImage(i.guild.iconURL({ size: 1024 })).setColor(colors.main)] });
    },
  },

  /* /membercount — dropdown setup instead of string option */
  {
    data: new SlashCommandBuilder().setName('membercount').setDescription('👥 Member count breakdown with live counters'),
    ns: 'mcount',
    embed(i) {
      const members = i.guild.members.cache;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;
      const online = members.filter(m => m.presence && m.presence.status !== 'offline').size;
      const pct = members.size ? Math.round((online / members.size) * 100) : 0;
      const filled = Math.round(pct / 10);
      return new EmbedBuilder()
        .setTitle(`👥 ${i.guild.name} — Member Count`)
        .setDescription([`**Total:** ${members.size}`, `**Humans:** ${humans}`, `**Bots:** ${bots}`, `**Online:** ${online} (${pct}%)`, `\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\` ${pct}%`].join('\n'))
        .setColor(colors.main)
        .setTimestamp();
    },
    async run(i, ctx) {
      await i.guild.members.fetch().catch(() => {});
      const setupSel = new StringSelectMenuBuilder().setCustomId('mcount:setup').setPlaceholder('⚙️ Live counter setup…')
        .addOptions(
          { label: 'Create live counter channels', value: 'create', emoji: '🆕', description: 'Locked voice channels that auto-update' },
          { label: 'Remove live counters', value: 'remove', emoji: '🗑️', description: 'Delete the counter channels' },
        );
      return i.reply({
        embeds: [this.embed(i)],
        components: [row(new ButtonBuilder().setCustomId('mcount:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)), row(setupSel)],
      });
    },
    async onButton(i) {
      await i.guild.members.fetch().catch(() => {});
      return i.update({ embeds: [this.embed(i)] });
    },
    async onSelect(i, ctx) {
      const g = ctx.guild(i.guildId);
      if (i.values[0] === 'remove') {
        if (!g.counterIds) return i.update({ content: '⚠️ No live counters set up.', components: [i.message.components[0]] });
        for (const id of Object.values(g.counterIds)) await i.guild.channels.delete(id).catch(() => {});
        g.counterIds = null;
        ctx.save();
        return i.update({ content: '🗑️ Live counters removed.', components: [i.message.components[0]] });
      }
      if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** for setup.');
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return err(i, 'I need **Manage Channels**.');
      await i.deferUpdate();
      await i.guild.members.fetch().catch(() => {});
      const members = i.guild.members.cache;
      const defs = [
        ['total', `👥 Total: ${members.size}`],
        ['humans', `🧑 Humans: ${members.filter(m => !m.user.bot).size}`],
        ['bots', `🤖 Bots: ${members.filter(m => m.user.bot).size}`],
        ['online', `🟢 Online: ${members.filter(m => m.presence && m.presence.status !== 'offline').size}`],
      ];
      const ids = {};
      for (const [key, name] of defs) {
        const ch = await i.guild.channels.create({
          name, type: ChannelType.GuildVoice,
          permissionOverwrites: [
            { id: i.guild.id, deny: ['Connect', 'SendMessages'] },
            { id: i.client.user.id, allow: ['Connect', 'ManageChannels'] },
          ],
        }).catch(() => null);
        if (ch) ids[key] = ch.id;
      }
      g.counterIds = ids;
      ctx.save();
      return i.editReply({ content: '✅ Created live counter channels — they update every 2 minutes.\n*If Online stays 0, enable **Server Presence Intent** in the Developer Portal.*' });
    },
  },

  /* /botinfo */
  {
    data: new SlashCommandBuilder().setName('botinfo').setDescription('🤖 Bot information'),
    async run(i) {
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
            { name: '⚙️ Commands', value: `${commands.length}`, inline: true },
            { name: '🧠 discord.js', value: require('discord.js').version, inline: true },
          )],
      });
    },
  },

  /* /stats */
  {
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
  },

  /* /boosts */
  {
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
  },

  /* /snipe */
  {
    data: new SlashCommandBuilder().setName('snipe').setDescription('🎯 Last deleted message in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async run(i, ctx) {
      const s = ctx.snipes.get(i.channel.id);
      if (!s) return err(i, 'Nothing to snipe here.');
      return i.reply({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: s.author, iconURL: s.avatar })
          .setDescription(s.content || '*no text*')
          .setImage(s.image)
          .setFooter({ text: 'Deleted' })
          .setTimestamp(s.at)
          .setColor(colors.main)],
        ephemeral: true,
      });
    },
  },

  /* /editsnipe */
  {
    data: new SlashCommandBuilder().setName('editsnipe').setDescription('✏️ Last edited message in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async run(i, ctx) {
      const s = ctx.editSnipes.get(i.channel.id);
      if (!s) return err(i, 'Nothing to snipe here.');
      return i.reply({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: s.author, iconURL: s.avatar })
          .addFields(
            { name: 'Before', value: (s.before || '*empty*').slice(0, 1000) },
            { name: 'After', value: (s.after || '*empty*').slice(0, 1000) },
          )
          .setFooter({ text: 'Edited' })
          .setTimestamp(s.at)
          .setColor(colors.warn)],
        ephemeral: true,
      });
    },
  },

  /* ─────────────── UTILITY ─────────────── */

  /* /say — channel dropdown + message modal */
  {
    data: new SlashCommandBuilder().setName('say').setDescription('💬 Make the bot say something')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(2000)),
    ns: 'sy',
    async run(i) {
      i.client.sayDrafts ??= new Map();
      i.client.sayDrafts.set(i.user.id, i.options.getString('message'));
      const sel = new StringSelectMenuBuilder().setCustomId('sy:channel').setPlaceholder('📺 Pick where to say it…')
        .addOptions(textChannels(i).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: c.id === i.channelId })));
      return i.reply({ content: `💬 Message: *${i.options.getString('message').slice(0, 150)}*\nPick the channel:`, components: [row(sel)], ephemeral: true });
    },
    async onSelect(i) {
      const draft = i.client.sayDrafts?.get(i.user.id);
      if (!draft) return err(i, 'Session expired — run `/say` again.');
      const ch = await i.guild.channels.fetch(i.values[0]).catch(() => null);
      if (!ch) return err(i, 'Channel not found.');
      await ch.send(draft).catch(() => {});
      i.client.sayDrafts.delete(i.user.id);
      return i.update({ content: `✅ Sent in ${ch}.`, components: [] });
    },
  },

  /* /remind — duration dropdown + text modal */
  {
    data: new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder — duration from a dropdown'),
    ns: 'rmd',
    async run(i) {
      const sel = new StringSelectMenuBuilder().setCustomId('rmd:dur').setPlaceholder('⏰ Remind me in…').addOptions(
        { label: '5 minutes', value: '5', emoji: '⏱️' },
        { label: '30 minutes', value: '30', emoji: '⏱️' },
        { label: '1 hour', value: '60', emoji: '🕐' },
        { label: '6 hours', value: '360', emoji: '🕐' },
        { label: '1 day', value: '1440', emoji: '📅' },
        { label: '1 week', value: '10080', emoji: '📅' },
      );
      return i.reply({ content: '⏰ Pick how long to wait, then write your reminder:', components: [row(sel)], ephemeral: true });
    },
    async onSelect(i) {
      const modal = new ModalBuilder().setCustomId(`rmd:modal:${i.values[0]}`).setTitle('Set Reminder');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('v').setLabel('What to remind you about').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)));
      return i.showModal(modal);
    },
    async onModal(i) {
      const minutes = parseInt(i.customId.split(':')[2], 10) || 5;
      const text = i.fields.getTextInputValue('v');
      await i.reply({ content: `⏰ Got it — I'll remind you in **${minutes} min**: *${text}*`, ephemeral: true });
      setTimeout(() => {
        i.user.send(`⏰ **Reminder:** ${text}`).catch(() =>
          i.channel?.send(`⏰ <@${i.user.id}> **Reminder:** ${text}`).catch(() => {}));
      }, minutes * 60 * 1000);
    },
  },

  /* /poll */
  {
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('📊 Create a reaction poll')
      .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('option3').setDescription('Option 3 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option4').setDescription('Option 4 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option5').setDescription('Option 5 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option6').setDescription('Option 6 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option7').setDescription('Option 7 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option8').setDescription('Option 8 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option9').setDescription('Option 9 (optional)').setMaxLength(50))
      .addStringOption(o => o.setName('option10').setDescription('Option 10 (optional)').setMaxLength(50)),
    async run(i) {
      const question = i.options.getString('question');
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => i.options.getString(`option${n}`)).filter(Boolean);
      const digits = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((o, x) => `${digits[x + 1]} ${o}`).join('\n'))
        .setAuthor({ name: `Poll by ${i.user.username}`, iconURL: i.user.displayAvatarURL() })
        .setColor(colors.main);
      const msg = await i.channel.send({ embeds: [embed] });
      for (let x = 1; x <= options.length; x++) await msg.react(digits[x]).catch(() => {});
      return i.reply({ content: '✅ Poll created.', ephemeral: true });
    },
  },

  /* /inrole */
  {
    data: new SlashCommandBuilder().setName('inrole').setDescription('👥 List members with a role')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    async run(i) {
      await i.deferReply({ ephemeral: true });
      const role = i.options.getRole('role');
      await i.guild.members.fetch().catch(() => {});
      const members = role.members.map(m => `<@${m.id}>`);
      if (!members.length) return i.editReply(`⚠️ Nobody has ${role}.`);
      return i.editReply({
        embeds: [new EmbedBuilder()
          .setTitle(`👥 ${role.name} — ${members.length} member(s)`)
          .setDescription(members.join(', ').slice(0, 4000))
          .setColor(role.color || colors.main)],
      });
    },
  },

  /* /channelcreate — type buttons + name modal */
  {
    data: new SlashCommandBuilder().setName('channelcreate').setDescription('📺 Create a channel — type from buttons')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true).setMaxLength(100)),
    ns: 'cc',
    async run(i) {
      i.client.ccDrafts ??= new Map();
      i.client.ccDrafts.set(i.user.id, i.options.getString('name'));
      i.client.ccType ??= new Map();
      return i.reply({
        content: `📺 Creating **${i.options.getString('name')}** — pick a type and category:`,
        components: [
          row(
            new ButtonBuilder().setCustomId('cc:text').setLabel('Text Channel').setEmoji('💬').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cc:voice').setLabel('Voice Channel').setEmoji('🔊').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cc:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
          ),
          row(menu('cc:cat', '📁 Category (optional)…',
            [{ label: 'No category', value: 'none', emoji: '🚫' },
             ...categories(i).map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁' }))])),
        ],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      const name = i.client.ccDrafts?.get(i.user.id);
      if (i.customId.endsWith('cancel')) { i.client.ccDrafts?.delete(i.user.id); return i.update({ content: '✖️ Cancelled.', components: [] }); }
      if (!name) return err(i, 'Session expired — run `/channelcreate` again.');
      const type = i.customId.endsWith('text') ? ChannelType.GuildText : ChannelType.GuildVoice;
      i.client.ccType.set(i.user.id, type);
      /* create immediately with no parent — simpler & works every time */
      const ch = await i.guild.channels.create({
        name: type === ChannelType.GuildVoice ? name : name.toLowerCase().replaceAll(' ', '-'),
        type, reason: `Created by ${i.user.tag}`,
      }).catch(() => null);
      i.client.ccDrafts?.delete(i.user.id);
      if (!ch) return err(i, 'I need **Manage Channels** to create channels.');
      return i.update({ content: `✅ Created ${ch} — drag it into a category anytime.`, components: [] });
    },
  },

  /* /rolecreate — color from dropdown */
  {
    data: new SlashCommandBuilder().setName('rolecreate').setDescription('🏷️ Create a role — color from a dropdown')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true).setMaxLength(100)),
    ns: 'rc',
    async run(i) {
      i.client.rcDrafts ??= new Map();
      i.client.rcDrafts.set(i.user.id, i.options.getString('name'));
      const sel = new StringSelectMenuBuilder().setCustomId('rc:color').setPlaceholder('🎨 Pick a color…')
        .addOptions([...MSG_COLORS, { label: 'Default (Blurple)', hex: '#5865F2' }].map(c => ({ label: c.label, value: c.hex, emoji: '🎨' })));
      return i.reply({ content: `🏷️ Creating role **${i.options.getString('name')}** — pick a color:`, components: [row(sel)], ephemeral: true });
    },
    async onSelect(i) {
      const name = i.client.rcDrafts?.get(i.user.id);
      if (!name) return err(i, 'Session expired — run `/rolecreate` again.');
      const role = await i.guild.roles.create({
        name,
        color: parseInt(i.values[0].replace('#', ''), 16),
        reason: `Created by ${i.user.tag}`,
      }).catch(() => null);
      i.client.rcDrafts?.delete(i.user.id);
      if (!role) return err(i, 'I need **Manage Roles** to create roles.');
      return i.update({ content: `✅ Created ${role}.`, components: [] });
    },
  },

  /* /ping */
  {
    data: new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency'),
    async run(i) {
      const sent = await i.reply({ content: '🏓 Pinging…', fetchReply: true });
      return i.editReply({
        content: '',
        embeds: [new EmbedBuilder()
          .setTitle('🏓 Pong!')
          .addFields(
            { name: '📡 Roundtrip', value: `${sent.createdTimestamp - i.createdTimestamp}ms`, inline: true },
            { name: '💓 API', value: `${Math.round(i.client.ws.ping)}ms`, inline: true },
          )
          .setColor(colors.good)],
      });
    },
  },

  /* /uptime */
  {
    data: new SlashCommandBuilder().setName('uptime').setDescription('⏱️ Bot uptime'),
    async run(i) {
      return i.reply({ content: `⏱️ Online for **${formatDuration(i.client.uptime)}**`, ephemeral: true });
    },
  },

  /* /invite */
  {
    data: new SlashCommandBuilder().setName('invite').setDescription('🔗 Invite the bot'),
    async run(i) {
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🔗 Invite OGs Bot')
          .setDescription(`[Click here to invite me](${inviteLink(i.client)})`)
          .setColor(colors.main)
          .setThumbnail(i.client.user.displayAvatarURL())],
      });
    },
  },
];

/* ═══════════════════════════ HONEYPOT ═══════════════════════════ */
const HP_DEFAULTS = () => ({
  enabled: false,
  channelIds: [],
  punishment: 'softban',       // softban | ban | kick | timeout | none
  timeoutMinutes: 60,
  message: {
    title: '⛔ No Chatting Here',
    description: 'This channel is a **trap**. Do **not** type here.\nTyping will get you punished automatically.',
  },
  whitelist: [],               // role IDs that are immune
  logChannelId: null,
  strikes: {},                 // userId -> count
  warnMessageIds: {},          // channelId -> live trap message id
});

function hpState(g) {
  const defaults = HP_DEFAULTS();
  const h = g.honeypot ??= defaults;
  h.channelIds ??= h.channels ?? defaults.channelIds;
  h.whitelist ??= h.whitelistRoles ?? defaults.whitelist;
  h.strikes ??= h.stats?.users ?? defaults.strikes;
  h.warnMessageIds ??= defaults.warnMessageIds;
  h.message ??= {
    title: h.warnTitle ?? defaults.message.title,
    description: h.warnDesc ?? defaults.message.description,
  };
  h.message.title ??= defaults.message.title;
  h.message.description ??= defaults.message.description;
  return h;
}

const hpPunishments = {
  softban:  { label: 'Softban',  emoji: '🔨', desc: 'Ban + immediate unban (deletes messages)' },
  ban:      { label: 'Ban',      emoji: '⚒️', desc: 'Permanent ban' },
  kick:     { label: 'Kick',     emoji: '👢', desc: 'Kick from the server' },
  timeout:  { label: 'Timeout',  emoji: '⏳', desc: 'Timed-out for a set duration' },
  none:     { label: 'Log only', emoji: '📋', desc: 'No punishment, log only' },
};

function hpWarnPayload(h) {
  const p = hpPunishments[h.punishment] ?? hpPunishments.softban;
  return {
    embeds: [new EmbedBuilder()
      .setTitle(h.message.title)
      .setDescription(h.message.description)
      .setColor(colors.bad)
      .setFooter({ text: `Punishment: ${p.label}` })],
    components: [row(new ButtonBuilder()
      .setCustomId('hpot:info')
      .setLabel(`Punishment: ${p.label}`)
      .setEmoji(p.emoji)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true))],
  };
}

commands.push({
  data: new SlashCommandBuilder().setName('honeypot').setDescription('🍯 Anti-raid trap channels — all buttons, one command')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ns: 'hpot',
  embed(g) {
    const h = hpState(g);
    const p = hpPunishments[h.punishment] ?? hpPunishments.softban;
    return new EmbedBuilder()
      .setTitle('🍯 Honeypot Control Panel')
      .setDescription(`**Status:** ${h.enabled ? '🟢 Deployed' : '🔴 Disabled'}\n**Traps:** ${h.channelIds.length ? h.channelIds.map(c => `<#${c}>`).join(', ') : '*none*'}\n**Punishment:** ${p.emoji} ${p.label}\n**Whitelist roles:** ${h.whitelist.length ? h.whitelist.map(r => `<@&${r}>`).join(', ') : '*none*'}`)
      .setColor(h.enabled ? colors.good : colors.main);
  },
  panel() {
    const h = this._h;
    return [
      row(
        new ButtonBuilder().setCustomId('hpot:toggle').setLabel(h.enabled ? '⬇️ Undeploy' : '🚀 Deploy').setStyle(h.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hpot:channels').setLabel('🍯 Trap Channels').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hpot:punish').setLabel('⚖️ Punishment').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hpot:message').setLabel('✉️ Message').setStyle(ButtonStyle.Secondary),
      ),
      row(
        new ButtonBuilder().setCustomId('hpot:whitelist').setLabel('🛡️ Whitelist').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:logs').setLabel('📜 Log Channel').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:test').setLabel('🧪 Test').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:close').setLabel('✖️').setStyle(ButtonStyle.Secondary),
      ),
    ];
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    this._h = hpState(g);
    ctx.save();
    return i.reply({ embeds: [this.embed(g)], components: this.panel(), ephemeral: true });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);
    this._h = h;
    const action = i.customId.split(':')[1];

    if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }

    if (action === 'info') return; /* disabled button on live trap messages */

    if (action === 'toggle') {
      h.enabled = !h.enabled;
      h.warnMessageIds ??= {};
      for (const chId of h.channelIds) {
        const ch = await i.guild.channels.fetch(chId).catch(() => null);
        if (!ch) continue;
        const oldId = h.warnMessageIds[chId];
        if (oldId) await ch.messages.delete(oldId).catch(() => {});
        delete h.warnMessageIds[chId];
        if (h.enabled) {
          const msg = await ch.send(hpWarnPayload(h)).catch(() => null);
          if (msg) h.warnMessageIds[chId] = msg.id;
        }
      }
      ctx.save();
      return i.update({ embeds: [this.embed(g)], components: this.panel() });
    }

    if (action === 'channels') {
      const opts = textChannels(i, 25).map(c => ({
        label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🍯',
        default: h.channelIds.includes(c.id),
      }));
      if (!opts.length) return err(i, 'No text channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:channelsSel')
        .setPlaceholder('🍯 Pick trap channels (multi-select)…')
        .setMinValues(0).setMaxValues(Math.min(opts.length, 25)).addOptions(opts);
      return i.reply({ content: '🍯 Select every channel that should be a trap. Selection **replaces** the current list.', components: [row(sel)], ephemeral: true });
    }

    if (action === 'punish') {
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:punishSel').setPlaceholder('⚖️ Pick a punishment…')
        .addOptions(Object.entries(hpPunishments).map(([k, v]) => ({
          label: v.label, value: k, emoji: v.emoji, description: v.desc, default: h.punishment === k,
        })));
      return i.reply({ components: [row(sel)], ephemeral: true });
    }

    if (action === 'message') {
      const modal = new ModalBuilder().setCustomId('hpot:msgModal').setTitle('Trap Message');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(h.message.title).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('Description (warns people not to type)').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(h.message.description).setRequired(true)),
      );
      return i.showModal(modal);
    }

    if (action === 'whitelist') {
      const opts = i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25)
        .map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🛡️' }));
      if (!opts.length) return err(i, 'No roles available.');
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:wlSel').setPlaceholder('🛡️ Immune roles (multi-select)…')
        .setMinValues(0).setMaxValues(opts.length).addOptions(opts);
      return i.reply({ content: '🛡️ Members with these roles can type in traps safely. Selection replaces the current list.', components: [row(sel)], ephemeral: true });
    }

    if (action === 'logs') {
      const opts = textChannels(i, 25).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜', default: h.logChannelId === c.id }));
      if (!opts.length) return err(i, 'No text channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:logsSel').setPlaceholder('📜 Evidence log channel…').addOptions(opts);
      return i.reply({ components: [row(sel)], ephemeral: true });
    }

    if (action === 'test') {
      if (!h.channelIds.length) return err(i, 'Pick trap channels first.');
      return i.reply({ ...hpWarnPayload(h), content: '🧪 **Test preview** — nobody is actually punished by this:', ephemeral: true });
    }

    if (action === 'stats') {
      const total = Object.values(h.strikes ?? {}).reduce((a, b) => a + b, 0);
      return i.reply({
        embeds: [new EmbedBuilder().setTitle('📊 Honeypot Stats')
          .setDescription(`**Total triggers:** ${total}\n**Unique users caught:** ${Object.keys(h.strikes ?? {}).length}\n**Active traps:** ${h.channelIds.length}`)
          .setColor(colors.main)],
        ephemeral: true,
      });
    }
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);
    const action = i.customId.split(':')[1];

    if (action === 'channelsSel') {
      const removed = h.channelIds.filter(id => !i.values.includes(id));
      h.channelIds = i.values;
      h.warnMessageIds ??= {};
      await i.deferUpdate();
      for (const chId of removed) {
        const oldId = h.warnMessageIds[chId];
        if (oldId) {
          const ch = await i.guild.channels.fetch(chId).catch(() => null);
          if (ch) await ch.messages.delete(oldId).catch(() => {});
          delete h.warnMessageIds[chId];
        }
      }
      for (const chId of i.values) {
        if (!h.enabled || h.warnMessageIds[chId]) continue;
        const ch = await i.guild.channels.fetch(chId).catch(() => null);
        if (!ch) continue;
        const msg = await ch.send(hpWarnPayload(h)).catch(() => null);
        if (msg) h.warnMessageIds[chId] = msg.id;
      }
      ctx.save();
      return i.editReply({ content: `✅ Traps set: ${h.channelIds.length ? h.channelIds.map(c => `<#${c}>`).join(', ') : '*none*'}`, components: [] });
    }

    if (action === 'punishSel') {
      h.punishment = i.values[0];
      ctx.save();
      return i.update({ content: `⚖️ Punishment: **${hpPunishments[h.punishment].label}** — press 🚀 Deploy again to refresh live trap messages.`, components: [] });
    }

    if (action === 'wlSel') { h.whitelist = i.values; ctx.save(); return i.update({ content: `🛡️ Whitelist: ${h.whitelist.length ? h.whitelist.map(r => `<@&${r}>`).join(', ') : '*empty*'}`, components: [] }); }
    if (action === 'logsSel') { h.logChannelId = i.values[0] ?? null; ctx.save(); return i.update({ content: `📜 Logs: ${h.logChannelId ? `<#${h.logChannelId}>` : '*disabled*'}`, components: [] }); }
  },
  async onModal(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);
    h.message.title = i.fields.getTextInputValue('t');
    h.message.description = i.fields.getTextInputValue('d');
    ctx.save();
    await i.deferReply({ ephemeral: true });
    h.warnMessageIds ??= {};
    for (const chId of h.channelIds) {
      const msgId = h.warnMessageIds[chId];
      if (!msgId) continue;
      const ch = await i.guild.channels.fetch(chId).catch(() => null);
      if (!ch) continue;
      await ch.messages.edit(msgId, hpWarnPayload(h)).catch(() => {});
    }
    return i.editReply({ content: '✅ Trap message updated everywhere. Preview:', ...hpWarnPayload(h) });
  },
});

/* ═══════════════════ honeypot engine (message listener) ═══════════════════ */
function registerHoneypot(client, ctx) {
  client.on('messageCreate', async (msg) => {
    try {
      if (!msg.guild || msg.author.bot || msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
      const g = ctx.guild(msg.guildId);
      const h = g ? hpState(g) : null;
      if (!h?.enabled || !h.channelIds?.includes(msg.channelId)) return;
      if (h.whitelist?.some(r => msg.member?.roles.cache.has(r))) return;
      await msg.delete().catch(() => {});

      h.strikes ??= {};
      h.strikes[msg.author.id] = (h.strikes[msg.author.id] ?? 0) + 1;
      ctx.save();

      const p = hpPunishments[h.punishment] ?? hpPunishments.softban;
      if (h.punishment === 'softban') {
        await msg.member.ban({ deleteMessageSeconds: 86400, reason: '🍯 Honeypot' })
          .then(() => msg.guild.members.unban(msg.author.id).catch(() => {}))
          .catch(() => {});
      } else if (h.punishment === 'ban') {
        await msg.member.ban({ reason: '🍯 Honeypot' }).catch(() => {});
      } else if (h.punishment === 'kick') {
        await msg.member.kick('🍯 Honeypot').catch(() => {});
      } else if (h.punishment === 'timeout') {
        await msg.member.timeout((h.timeoutMinutes ?? 60) * 60_000, '🍯 Honeypot').catch(() => {});
      }

      if (h.logChannelId) {
        const logCh = await msg.guild.channels.fetch(h.logChannelId).catch(() => null);
        if (logCh) {
          logCh.send({
            embeds: [new EmbedBuilder()
              .setTitle(`🍯 Honeypot — ${p.label}`)
              .setDescription(`<@${msg.author.id}> (${msg.author.tag}) typed in <#${msg.channelId}>\n**Strikes:** ${h.strikes[msg.author.id]}\n\`\`\`${(msg.content || '*no text*').slice(0, 500)}\`\`\``)
              .setColor(colors.bad)
              .setTimestamp()],
          }).catch(() => {});
        }
      }
      msg.author.send(`🍯 You were punished (**${p.label}**) in **${msg.guild.name}** for typing in a protected channel.`).catch(() => {});
    } catch { /* never crash the bot over honeypot */ }
  });
}

/* ═══════════════════════════ helpers used above ═══════════════════════════ */
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d}d ` : ''}${h ? `${h}h ` : ''}${m}m`;
}

function inviteLink(client) {
  return `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
}

module.exports = { commands, registerHoneypot };