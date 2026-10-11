const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err } = require('./_shared');

/* ═══════════════ command catalog ═══════════════ */
const CATEGORIES = [
  {
    id: 'setup', label: 'Setup', emoji: '⚙️', color: '#5865F2',
    blurb: 'Configure the bot\u2019s core systems',
    commands: [
      ['/welcome', 'Set up welcome messages with templates, colors, and a channel', 'Configure the welcome system: pick a template, embed color, and the channel where new members get greeted.'],
      ['/goodbye', 'Set up goodbye messages with templates, colors, and a channel', 'Same builder as /welcome, but for members leaving the server.'],
      ['/announce', 'Build a polished announcement with channel, ping, color, style, and preview', 'Full visual editor: live preview, custom hex colors, ping options, styles, templates, banners and thumbnails.'],
      ['/jointocreate', 'Creates a join-to-create voice lobby system', 'Members join a lobby channel and get their own temporary voice channel automatically.'],
      ['/autorole', 'Auto-assign roles when members join', 'Give new members one or more roles the moment they join.'],
      ['/selfroles', 'Let members choose roles for themselves', 'Publish a panel where members can pick their own roles.'],
      ['/ticket', 'Create a support ticket panel', 'Deploy a button panel that opens private staff-visible ticket channels.'],
      ['/logs', 'Set the bot’s log channel', 'Choose where moderation and server events get logged.'],
      ['/honeypot', 'Set up anti-raid trap channels', 'Invisible trap channels that auto-ban raid bots which join or type in them.'],
      ['/verify', 'Post a captcha verification panel', 'Members click a button, solve a short typed captcha, and get the verified role set in /setup.'],
      ['/medalforward', 'Auto-forward Medal.tv clip links to a channel', 'Any message with a medal.tv link, in any channel, is automatically forwarded to the channel set here or in /setup.'],
      ['/embed', 'Create rich Discord embeds using a webhook', 'Build and send clean webhook embeds, no bot branding.'],
      ['/refresh', 'Re-register slash commands instantly', 'Push application commands to Discord without restarting the bot.'],
    ],
  },
  {
    id: 'moderation', label: 'Moderation', emoji: '🛡️', color: '#ED4245',
    blurb: 'Keep your server safe and tidy',
    commands: [
      ['/slowmode', 'Set a channel slowmode from presets', 'Apply a cooldown between messages from quick presets or a custom value.'],
      ['/lock', 'Lock a channel so members can’t chat', 'Instantly deny send-permissions for the everyone role.'],
      ['/unlock', 'Unlock a channel', 'Reverse a /lock and restore normal chatting.'],
      ['/unban', 'Unban a user from the ban list', 'Lift a ban by user ID or pick from the ban list.'],
      ['/bans', 'View all banned users and reasons', 'Paginated list of every ban with the stated reason.'],
      ['/user', 'Member info, moderation, purge, and deleted-message history', 'Inspect a member, moderate them, purge their recent messages, and review deleted messages from the current channel.'],
    ],
  },
  {
    id: 'info', label: 'Info', emoji: 'ℹ️', color: '#00B0F4',
    blurb: 'Server, channel and member statistics',
    commands: [
      ['/serverinfo', 'Server stats and details', 'Ownership, creation date, boosts, roles, channels and more.'],
      ['/channelinfo', 'Information about a specific channel', 'Type, topic, position, permissions and slowmode for any channel.'],
      ['/membercount', 'Live member breakdown (humans, bots, online)', 'Humans vs bots, online status split, and join trends.'],
      ['/botinfo', 'Bot stats like ping, uptime, and server count', 'WebSocket and API latency, memory usage, uptime and shard info.'],
    ],
  },
  {
    id: 'utility', label: 'Utility', emoji: '🧰', color: '#57F287',
    blurb: 'Handy everyday tools',
    commands: [
      ['/say', 'Make the bot say a custom message', 'Send plain text or an embed as the bot.'],
      ['/remind', 'Set a reminder that DMs you later', 'Natural-language reminders delivered straight to your DMs.'],
      ['/inrole', 'List all members with a specific role', 'Paginated member list for any role, with counts.'],
      ['/channelcreate', 'Create a channel from the command UI', 'Full creation panel: name, type, topic, NSFW and position.'],
      ['/rolecreate', 'Create a role with a color picker', 'Create roles with a color picker, icon and permission presets.'],
      ['/ping', 'Full connection diagnostics (admin only)', 'Roundtrip, WebSocket heartbeat, REST latency, uptime, memory, and version info.'],
      ['/uptime', 'Show how long the bot has been online', 'Precise uptime with a human-readable breakdown.'],
      ['/invite', 'Get the bot invite link', 'Button link with the correct permissions pre-selected.'],
    ],
  },
  {
    id: 'bot', label: 'Bot', emoji: '🤖', color: '#EB459E',
    blurb: 'About this bot',
    commands: [
      ['/commands', 'Browse the command list and categories', 'Interactive, searchable command browser — you’re looking at it right now.'],
    ],
  },
];

const ALL = CATEGORIES.flatMap(c => c.commands.map(([name, short, long]) => ({ name, short, long, cat: c })));
const TOTAL = ALL.length;

/* ═══════════════ state ═══════════════ */
const sessions = new Map(); // userId -> { mode, catId?, cmdName?, results? }
const getSession = i => sessions.get(i.user.id) ?? { mode: 'home' };
const save = (i, s) => sessions.set(i.user.id, s);

function botStats(i) {
  const c = i.client, up = c.uptime ?? 0;
  return {
    ping: Math.max(0, c.ws.ping || 0),
    servers: c.guilds.cache.size,
    uptime: `${Math.floor(up / 86400000)}d ${Math.floor(up / 3600000) % 24}h ${Math.floor(up / 60000) % 60}m`,
  };
}

/* ═══════════════ embeds ═══════════════ */
function homeEmbed(i) {
  const st = botStats(i);
  return new EmbedBuilder()
    .setColor(colors.main)
    .setAuthor({ name: i.client.user.username, iconURL: i.client.user.displayAvatarURL() })
    .setTitle('Command Center')
    .setDescription(
      `Welcome, **${i.user.username}** — ${TOTAL} commands in ${CATEGORIES.length} categories.\n\n` +
      CATEGORIES.map(c => `${c.emoji} **${c.label}** · ${c.commands.length}`).join('  |  ') +
      '\n\n_Tap a module below, or press 🔍 **Search** to find a command._',
    )
    .addFields(
      { name: '📶 Ping', value: `\`${st.ping}ms\``, inline: true },
      { name: '⏱️ Uptime', value: `\`${st.uptime}\``, inline: true },
      { name: '🌐 Servers', value: `\`${st.servers}\``, inline: true },
    )
    .setThumbnail(i.client.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: '/commands' });
}

function catEmbed(i, c) {
  const idx = CATEGORIES.indexOf(c);
  const e = new EmbedBuilder()
    .setColor(parseInt(c.color.slice(1), 16) || colors.main)
    .setAuthor({ name: `Module ${idx + 1} of ${CATEGORIES.length}`, iconURL: i.client.user.displayAvatarURL() })
    .setTitle(`${c.emoji} ${c.label}`)
    .setDescription(c.blurb);

  // Each command is its own field: name as heading, description under it.
  for (const [name, short] of c.commands) {
    e.addFields({ name: name, value: short });
  }

  e.setFooter({ text: `🔍 Search opens any command\u2019s detail page • /commands` });
  return e;
}

function cmdEmbed(i, cmd) {
  const c = cmd.cat;
  const pos = c.commands.findIndex(([n]) => n === cmd.name) + 1;
  return new EmbedBuilder()
    .setColor(parseInt(c.color.slice(1), 16) || colors.main)
    .setAuthor({ name: `${c.emoji} ${c.label} • command ${pos}/${c.commands.length}`, iconURL: i.client.user.displayAvatarURL() })
    .setTitle(cmd.name)
    .setDescription(cmd.long)
    .addFields(
      { name: '📝 Summary', value: cmd.short },
      { name: '📂 Module', value: `\`${c.label}\``, inline: true },
      { name: '⚡ Usage', value: `\`${cmd.name}\``, inline: true },
    )
    .setThumbnail(i.client.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: '◀️ Back to category • 🏠 Home • /commands' });
}

function searchEmbed(q, results) {
  return new EmbedBuilder().setColor(colors.main).setTitle(`Results for “${q}”`)
    .setDescription(results.length
      ? `**${results.length}** match${results.length === 1 ? '' : 'es'} found — pick one below:`
      : `Nothing matched **“${q}”**. Try a shorter keyword like \`role\` or \`lock\`.`)
    .setFooter({ text: '/commands' });
}

/* ═══════════════ components ═══════════════ */
function navRow(s) {
  return row(
    new ButtonBuilder().setCustomId('cmds:home').setLabel('Home').setEmoji('🏠').setStyle(ButtonStyle.Secondary).setDisabled(s.mode === 'home'),
    new ButtonBuilder().setCustomId('cmds:search').setLabel('Search').setEmoji('🔍').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cmds:prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cmds:next').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
  );
}
function quickJumpRow() {
  const styles = {
    setup: ButtonStyle.Primary,
    moderation: ButtonStyle.Danger,
    info: ButtonStyle.Primary,
    utility: ButtonStyle.Success,
    bot: ButtonStyle.Secondary,
  };
  return row(...CATEGORIES.map(c =>
    new ButtonBuilder().setCustomId(`cmds:jump:${c.id}`).setLabel(c.label).setEmoji(c.emoji).setStyle(styles[c.id] ?? ButtonStyle.Secondary)));
}
function resultsMenu(results) {
  return row(new StringSelectMenuBuilder().setCustomId('cmds:pick').setPlaceholder('📖 Open a result…')
    .addOptions(results.slice(0, 25).map(name => {
      const cmd = ALL.find(a => a.name === name);
      const option = { label: cmd.name.slice(1), value: cmd.name, description: cmd.short.slice(0, 100) };
      if (cmd.cat.emoji) option.emoji = cmd.cat.emoji;
      return option;
    })));
}
function componentsFor(s) {
  const rows = [navRow(s), quickJumpRow()];
  if (s.mode === 'results') rows.push(resultsMenu(s.results));
  return rows;
}

/* ═══════════════ render helpers ═══════════════ */
function showHome(i) { return i.update({ embeds: [homeEmbed(i)], components: componentsFor({ mode: 'home' }) }); }
function showCat(i, c) { save(i, { mode: 'cat', catId: c.id }); return i.update({ embeds: [catEmbed(i, c)], components: componentsFor({ mode: 'cat', catId: c.id }) }); }
function showCmd(i, cmd, s = {}) { save(i, { mode: 'cmd', catId: cmd.cat.id, results: s.results }); return i.update({ embeds: [cmdEmbed(i, cmd)], components: componentsFor({ mode: 'cmd', catId: cmd.cat.id, results: s.results }) }); }

function step(i, s, dir) {
  if (s.mode === 'cmd') {
    const idx = CATEGORIES.findIndex(c => c.id === s.catId);
    return showCat(i, CATEGORIES[(idx + dir + CATEGORIES.length) % CATEGORIES.length]);
  }
  if (s.mode === 'cat') {
    const idx = CATEGORIES.findIndex(c => c.id === s.catId);
    if ((dir === 1 && idx === CATEGORIES.length - 1) || (dir === -1 && idx === 0)) return showHome(i);
    return showCat(i, CATEGORIES[idx + dir]);
  }
  return showCat(i, dir === 1 ? CATEGORIES[0] : CATEGORIES[CATEGORIES.length - 1]);
}

/* ═══════════════ search ═══════════════ */
function searchCommands(q) {
  const qd = q.toLowerCase();
  return ALL.map(cmd => {
    const name = cmd.name.slice(1).toLowerCase();
    let score = 0;
    if (name === qd) score += 100;
    if (name.startsWith(qd)) score += 50;
    if (name.includes(qd)) score += 25;
    if (cmd.short.toLowerCase().includes(qd)) score += 10;
    if (cmd.long.toLowerCase().includes(qd)) score += 5;
    if (cmd.cat.label.toLowerCase().includes(qd)) score += 3;
    return { cmd, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 25).map(x => x.cmd.name);
}

/* ═══════════════ command ═══════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Browse the command list and categories')
    .setDefaultMemberPermissions(PermissionFlagsBits.UseApplicationCommands),
  ns: 'cmds',
  async run(i) {
    sessions.delete(i.user.id);
    return i.reply({ embeds: [homeEmbed(i)], components: componentsFor({ mode: 'home' }), ephemeral: true });
  },

  async onButton(i) {
    const s = getSession(i);
    const [, action, arg] = i.customId.split(':');

    if (action === 'home') return showHome(i);
    if (action === 'prev') return step(i, s, -1);
    if (action === 'next') return step(i, s, 1);
    if (action === 'jump' && arg) {
      const c = CATEGORIES.find(x => x.id === arg);
      if (!c) return err(i, 'Unknown category.');
      return showCat(i, c);
    }
    if (action === 'search') {
      const modal = new ModalBuilder().setCustomId('cmds:searchModal').setTitle('Search Commands');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('q').setLabel('Keyword (e.g. "purge" or "role")')
          .setStyle(TextInputStyle.Short).setMaxLength(50).setPlaceholder('purge').setRequired(true)));
      return i.showModal(modal);
    }
  },

  async onSelect(i) {
    const s = getSession(i);
    if (i.customId !== 'cmds:pick') return;
    const cmd = ALL.find(a => a.name === i.values[0]);
    if (!cmd) return err(i, 'Unknown command.');
    return showCmd(i, cmd, s);
  },

  async onModal(i) {
    if (i.customId !== 'cmds:searchModal') return;
    const q = i.fields.getTextInputValue('q');
    const results = searchCommands(q);
    save(i, { mode: 'results', results, catId: null });
    return i.update({ embeds: [searchEmbed(q, results)], components: componentsFor({ mode: 'results', results }) });
  },
};