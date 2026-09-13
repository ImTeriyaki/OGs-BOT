const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row } = require('./_shared');

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
    { n: 'embed', d: 'Set up a webhook in this channel, then paste JSON from discohook.org to send a rich embed.', u: '/embed' },
    { n: 'refresh', d: 'Re-register slash commands instantly (admin only).', u: '/refresh' },
  ]},
  { name: 'Moderation', emoji: '🛡️', commands: [
    { n: 'purge', d: 'Bulk delete messages — pick the amount from a dropdown, optionally one user.', u: '/purge [user:@user]' },
    { n: 'slowmode', d: 'Set slowmode from a dropdown of presets. Off included.', u: '/slowmode' },
    { n: 'lock', d: 'Lock this channel so nobody can send messages.', u: '/lock' },
    { n: 'unlock', d: 'Unlock this channel.', u: '/unlock' },
    { n: 'unban', d: 'Unban a user — pick from the ban list dropdown.', u: '/unban' },
    { n: 'bans', d: 'List every banned user and their ban reason.', u: '/bans' },
    { n: 'user', d: 'One panel for a member — info plus kick, ban, timeout, warn, roles, nickname, avatar & DM buttons.', u: '/user member:@user' },
  ]},
  { name: 'Info', emoji: '📊', commands: [
    { n: 'serverinfo', d: 'Detailed server information card — refresh, full-size icon & boost-perks buttons.', u: '/serverinfo' },
    { n: 'roleinfo', d: 'Role details — members list & color preview included.', u: '/roleinfo role:@role' },
    { n: 'channelinfo', d: 'Channel details with quick-action buttons.', u: '/channelinfo [channel:#chan]' },
    { n: 'membercount', d: 'Live humans/bots/online breakdown with bar chart & setup.', u: '/membercount' },
    { n: 'botinfo', d: 'Statistics about this bot.', u: '/botinfo' },
    { n: 'stats', d: 'Live server activity stats — members, channels, roles, boosts.', u: '/stats' },
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
    { n: 'ping', d: 'Bot latency and API latency — button to announce here when the bot comes online.', u: '/ping' },
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('commands')
    .setDescription('📋 Browse every command — descriptions, usage, categories & pages (admin reference)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
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
};
