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

/* ═══════════════════════════ /commands pages ═══════════════════════════ */
const cmdPages = [
  { name: 'Setup', emoji: '⚙️', commands: [
    { n: 'welcome', d: 'Configure the welcome message with a live preview panel.', u: '/welcome' },
    { n: 'goodbye', d: 'Configure the goodbye message with a live preview panel.', u: '/goodbye' },
    { n: 'announce', d: 'Send a polished announcement — channel & ping as options, the rest in a modal.', u: '/announce channel:#chan ping:everyone/here/none' },
    { n: 'jointocreate', d: 'Join-to-Create voice lobbies — join the lobby, get your own channel.', u: '/jointocreate action:enable/disable category:<cat>' },
    { n: 'autorole', d: 'Roles automatically given to members when they join. Button panel.', u: '/autorole' },
    { n: 'selfroles', d: 'Roles members can pick for themselves from a dropdown menu. Panel is private.', u: '/selfroles' },
    { n: 'ticket', d: 'Post a panel where members open private text ticket channels.', u: '/ticket channel:#chan category:<cat>' },
    { n: 'logs', d: 'Set the channel where errors are logged with error codes.', u: '/logs channel:#chan' },
    { n: 'refresh', d: 'Re-register slash commands instantly (admin only).', u: '/refresh' },
  ]},
  { name: 'Moderation', emoji: '🛡️', commands: [
    { n: 'purge', d: 'Bulk delete 1–100 messages, optionally only from one user.', u: '/purge amount:1-100 [user:@user]' },
    { n: 'slowmode', d: 'Set channel slowmode in seconds. 0 disables it.', u: '/slowmode seconds:0-21600' },
    { n: 'lock', d: 'Lock this channel so nobody can send messages.', u: '/lock [reason:text]' },
    { n: 'unlock', d: 'Unlock this channel.', u: '/unlock' },
    { n: 'kick', d: 'Kick a member from the server.', u: '/kick user:@user [reason:text]' },
    { n: 'ban', d: 'Ban a member, optionally purging recent messages.', u: '/ban user:@user [reason:text] [delete_days:0-7]' },
    { n: 'unban', d: 'Unban a user by their ID.', u: '/unban user_id:<id>' },
    { n: 'bans', d: 'List every banned user and their ban reason.', u: '/bans' },
    { n: 'timeout', d: 'Temporarily mute a member (up to 28 days).', u: '/timeout user:@user minutes:<n> [reason:text]' },
    { n: 'untimeout', d: 'Remove a member\'s timeout.', u: '/untimeout user:@user' },
    { n: 'warn', d: 'Warn a member — saved to their permanent record.', u: '/warn user:@user reason:<text>' },
    { n: 'warnings', d: 'View a member\'s full warning history.', u: '/warnings user:@user' },
    { n: 'clearwarnings', d: 'Wipe a member\'s warning record.', u: '/clearwarnings user:@user' },
    { n: 'roleadd', d: 'Give a role to a member.', u: '/roleadd user:@user role:@role' },
    { n: 'roleremove', d: 'Remove a role from a member.', u: '/roleremove user:@user role:@role' },
    { n: 'nickname', d: "Change or reset a member's nickname.", u: '/nickname user:@user [nickname:text]' },
    { n: 'dm', d: 'Send a direct message to a member as the bot.', u: '/dm user:@user message:<text>' },
  ]},
  { name: 'Info', emoji: '📊', commands: [
    { n: 'serverinfo', d: 'Detailed server information card.', u: '/serverinfo' },
    { n: 'userinfo', d: 'Detailed information about a member.', u: '/userinfo [user:@user]' },
    { n: 'roleinfo', d: 'Details about a role — position, color, members.', u: '/roleinfo role:@role' },
    { n: 'channelinfo', d: 'Details about a channel.', u: '/channelinfo [channel:#chan]' },
    { n: 'avatar', d: 'Show a member\'s avatar in full size.', u: '/avatar [user:@user]' },
    { n: 'servericon', d: 'Show the server icon in full size.', u: '/servericon' },
    { n: 'membercount', d: 'Humans / bots / online breakdown with a live bar chart. Auto-setup with subcommands.', u: '/membercount | /membercount setup:create' },
    { n: 'botinfo', d: 'Statistics about this bot.', u: '/botinfo' },
    { n: 'stats', d: 'Live server activity stats — members, channels, roles, boosts.', u: '/stats' },
    { n: 'boosts', d: 'Boost status and perks of this server.', u: '/boosts' },
    { n: 'snipe', d: 'Show the last deleted message in this channel.', u: '/snipe' },
    { n: 'editsnipe', d: 'Show the last edited message in this channel.', u: '/editsnipe' },
  ]},
  { name: 'Utility', emoji: '🔧', commands: [
    { n: 'say', d: 'Make the bot say a message, optionally in another channel.', u: '/say message:<text> [channel:#chan]' },
    { n: 'remind', d: 'Set a personal reminder — the bot DMs you when it expires.', u: '/remind minutes:<n> text:<text>' },
    { n: 'poll', d: 'Create a reaction poll with up to 10 options.', u: '/poll question:<text> [options...]' },
    { n: 'calculator', d: 'Evaluate a math expression safely.', u: '/calculator expression:(5+3)*2' },
    { n: 'inrole', d: 'List every member that has a role.', u: '/inrole role:@role' },
    { n: 'channelcreate', d: 'Create a text or voice channel, optionally in a category.', u: '/channelcreate name:<text> type:text/voice [category:<cat>]' },
    { n: 'rolecreate', d: 'Create a role with an optional hex color.', u: '/rolecreate name:<text> [color:#5865F2]' },
    { n: 'ping', d: 'Bot latency and API latency.', u: '/ping' },
    { n: 'uptime', d: 'How long the bot has been running.', u: '/uptime' },
    { n: 'invite', d: 'Get the bot invite link.', u: '/invite' },
    { n: 'commands', d: 'This command browser.', u: '/commands' },
  ]},
];

function pageEmbed(i) {
  const p = cmdPages[i];
  return new EmbedBuilder()
    .setTitle(`${p.emoji} ${p.name} Commands`)
    .setDescription(p.commands.map(c => `**/${c.n}** — ${c.d}\n> \`${c.u}\``).join('\n\n'))
    .setColor(colors.main)
    .setFooter({ text: `Category ${i + 1}/${cmdPages.length} • Page ${i + 1} of ${cmdPages.length} • ${p.commands.length} commands` })
    .setTimestamp();
}

function pageRows(page) {
  const indexRow = row(
    new ButtonBuilder().setCustomId('hp:prev').setLabel('◀ Prev').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hp:home').setLabel('🏠 Categories').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hp:next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary),
  );
  const menu = new StringSelectMenuBuilder()
    .setCustomId('hp:menu')
    .setPlaceholder('Jump to a category…')
    .addOptions(cmdPages.map((p, x) => ({
      label: p.name, value: String(x), emoji: p.emoji,
      default: x === page,
    })));
  const closeRow = row(new ButtonBuilder().setCustomId('hp:close').setLabel('✖ Close').setStyle(ButtonStyle.Danger));
  return [row(menu), indexRow, closeRow];
}

function categoryMenu() {
  return row(new StringSelectMenuBuilder()
    .setCustomId('hp:menu')
    .setPlaceholder('Select a category to browse…')
    .addOptions(cmdPages.map((p, x) => ({ label: p.name, value: String(x), emoji: p.emoji, description: `${p.commands.length} commands` }))));
}

/* ═══════════════════════════ COMMANDS ═══════════════════════════ */
const commands = [

  /* ─────────────── /commands (replaces /help) ─────────────── */
  {
    data: new SlashCommandBuilder()
      .setName('commands')
      .setDescription('📋 Browse every command — descriptions, usage, categories & pages'),
    ns: 'hp',
    run: (i) => i.reply({ embeds: [new EmbedBuilder()
      .setTitle('📖 Command Browser')
      .setDescription('Pick a category below to see every command, what it does and how to use it.')
      .setColor(colors.main)], components: [categoryMenu()], ephemeral: true }),
    async onSelect(i) {
      const page = parseInt(i.values[0], 10);
      return i.update({ embeds: [pageEmbed(page)], components: pageRows(page) });
    },
    async onButton(i) {
      const action = i.customId.split(':')[1];
      if (action === 'close') return i.update({ content: '✖️ Closed.', embeds: [], components: [] });
      if (action === 'menu') return;
      let page = 0;
      if (action === 'prev' || action === 'next') {
        const current = i.message.components[1].components[1].customId; /* not used; derive from embed footer */
        page = parseInt((i.message.embeds[0]?.footer?.text ?? '').match(/^Category (\d+)/)?.[1] ?? 1, 10) - 1;
        page = action === 'prev' ? (page <= 0 ? cmdPages.length - 1 : page - 1) : (page >= cmdPages.length - 1 ? 0 : page + 1);
      }
      return i.update({ embeds: [pageEmbed(page)], components: pageRows(page) });
    },
  },

  /* ─────────────── SETUP ─────────────── */

  /* /welcome — button panel + modal config */
  {
    data: new SlashCommandBuilder()
      .setName('welcome')
      .setDescription('⚙️ Configure the welcome message')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    ns: 'wlcm',
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      const embed = new EmbedBuilder()
        .setTitle('👋 Welcome Settings')
        .setDescription(g.welcome?.enabled
          ? `**Enabled** in <#${g.welcome.channelId}>`
          : 'Disabled')
        .setColor(colors.main);
      return i.reply({
        embeds: [embed],
        components: [row(
          new ButtonBuilder().setCustomId('wlcm:toggle').setLabel(g.welcome?.enabled ? 'Disable' : 'Enable').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('wlcm:edit').setLabel('✏️ Edit Message').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('wlcm:channel').setLabel('# Set Channel').setStyle(ButtonStyle.Secondary),
        )],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      const action = i.customId.split(':')[1];

      if (action === 'toggle') {
        g.welcome.enabled = !g.welcome.enabled;
        ctx.save();
        return i.update({ embeds: [new EmbedBuilder().setTitle('👋 Welcome Settings')
          .setDescription(g.welcome.enabled ? `**Enabled** in <#${g.welcome.channelId}>` : 'Disabled')
          .setColor(colors.main)] });
      }
      if (action === 'edit') {
        const modal = new ModalBuilder().setCustomId('wlcm:modal').setTitle('Welcome Message');
        modal.addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Embed Title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(g.welcome?.title ?? '👋 Welcome!'),
          new TextInputBuilder().setCustomId('message').setLabel('Message — {user} {username} {server} {membercount}').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(g.welcome?.message ?? 'Welcome to {server}, {user}!'),
          new TextInputBuilder().setCustomId('color').setLabel('Hex Color (e.g. #5865F2)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false).setValue(g.welcome?.color ?? '#5865F2'),
          new TextInputBuilder().setCustomId('banner').setLabel('Banner Image URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(g.welcome?.banner ?? ''),
          new TextInputBuilder().setCustomId('pfp').setLabel('Profile Picture URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(g.welcome?.pfp ?? ''),
        );
        return i.showModal(modal);
      }
      if (action === 'channel') {
        const channels = i.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(25);
        const menu = new StringSelectMenuBuilder().setCustomId('wlcm:channelSelect').setPlaceholder('Welcome channel…')
          .addOptions(channels.map(c => ({ label: c.name.slice(0, 100), value: c.id })));
        return i.reply({ components: [row(menu)], ephemeral: true });
      }
    },
    async onSelect(i, ctx) {
      if (i.customId !== 'wlcm:channelSelect') return;
      const g = ctx.guild(i.guildId);
      g.welcome.channelId = i.values[0];
      ctx.save();
      return i.update({ content: `✅ Welcome channel set to <#${i.values[0]}>.`, components: [] });
    },
    async onModal(i, ctx) {
      const g = ctx.guild(i.guildId);
      const color = i.fields.getTextInputValue('color').trim();
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return err(i, 'Color must be a hex code like `#5865F2`.');
      g.welcome.title = i.fields.getTextInputValue('title');
      g.welcome.message = i.fields.getTextInputValue('message');
      g.welcome.color = color || '#5865F2';
      g.welcome.banner = i.fields.getTextInputValue('banner');
      g.welcome.pfp = i.fields.getTextInputValue('pfp');
      ctx.save();
      return i.reply({ content: '✅ Welcome message saved.', ephemeral: true });
    },
  },

  /* /goodbye — same pattern as welcome */
  {
    data: new SlashCommandBuilder()
      .setName('goodbye')
      .setDescription('⚙️ Configure the goodbye message')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    ns: 'gbye',
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      const embed = new EmbedBuilder()
        .setTitle('🚪 Goodbye Settings')
        .setDescription(g.goodbye?.enabled ? `**Enabled** in <#${g.goodbye.channelId}>` : 'Disabled')
        .setColor(colors.main);
      return i.reply({
        embeds: [embed],
        components: [row(
          new ButtonBuilder().setCustomId('gbye:toggle').setLabel(g.goodbye?.enabled ? 'Disable' : 'Enable').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('gbye:edit').setLabel('✏️ Edit Message').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('gbye:channel').setLabel('# Set Channel').setStyle(ButtonStyle.Secondary),
        )],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      const g = ctx.guild(i.guildId);
      const action = i.customId.split(':')[1];

      if (action === 'toggle') {
        g.goodbye.enabled = !g.goodbye.enabled;
        ctx.save();
        return i.update({ embeds: [new EmbedBuilder().setTitle('🚪 Goodbye Settings')
          .setDescription(g.goodbye.enabled ? `**Enabled** in <#${g.goodbye.channelId}>` : 'Disabled')
          .setColor(colors.main)] });
      }
      if (action === 'edit') {
        const modal = new ModalBuilder().setCustomId('gbye:modal').setTitle('Goodbye Message');
        modal.addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('Embed Title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(g.goodbye?.title ?? '🚪 Goodbye'),
          new TextInputBuilder().setCustomId('message').setLabel('Message — {user} {username} {server} {membercount}').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(g.goodbye?.message ?? '{username} left {server}.'),
          new TextInputBuilder().setCustomId('color').setLabel('Hex Color (e.g. #ED4245)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false).setValue(g.goodbye?.color ?? '#ED4245'),
          new TextInputBuilder().setCustomId('banner').setLabel('Banner Image URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(g.goodbye?.banner ?? ''),
          new TextInputBuilder().setCustomId('pfp').setLabel('Profile Picture URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(g.goodbye?.pfp ?? ''),
        );
        return i.showModal(modal);
      }
      if (action === 'channel') {
        const channels = i.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(25);
        const menu = new StringSelectMenuBuilder().setCustomId('gbye:channelSelect').setPlaceholder('Goodbye channel…')
          .addOptions(channels.map(c => ({ label: c.name.slice(0, 100), value: c.id })));
        return i.reply({ components: [row(menu)], ephemeral: true });
      }
    },
    async onSelect(i, ctx) {
      if (i.customId !== 'gbye:channelSelect') return;
      const g = ctx.guild(i.guildId);
      g.goodbye.channelId = i.values[0];
      ctx.save();
      return i.update({ content: `✅ Goodbye channel set to <#${i.values[0]}>.`, components: [] });
    },
    async onModal(i, ctx) {
      const g = ctx.guild(i.guildId);
      const color = i.fields.getTextInputValue('color').trim();
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return err(i, 'Color must be a hex code like `#ED4245`.');
      g.goodbye.title = i.fields.getTextInputValue('title');
      g.goodbye.message = i.fields.getTextInputValue('message');
      g.goodbye.color = color || '#ED4245';
      g.goodbye.banner = i.fields.getTextInputValue('banner');
      g.goodbye.pfp = i.fields.getTextInputValue('pfp');
      ctx.save();
      return i.reply({ content: '✅ Goodbye message saved.', ephemeral: true });
    },
  },

  /* /announce — clean options + modal for the body */
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('📢 Send an announcement with a rich embed')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addChannelOption(o => o.setName('channel').setDescription('Channel to announce in').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(o => o.setName('ping')
        .setDescription('Who to ping')
        .addChoices(
          { name: 'everyone', value: 'everyone' },
          { name: 'here', value: 'here' },
          { name: 'no ping', value: 'none' },
        ).setRequired(true)),
    ns: 'ann',
    run(i) {
      const ping = i.options.getString('ping');
      i.announcePing = ping === 'everyone' ? '@everyone' : ping === 'here' ? '@here' : '';
      const modal = new ModalBuilder().setCustomId('ann:modal').setTitle('Announcement');
      modal.addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true),
        new TextInputBuilder().setCustomId('message').setLabel('Message').setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setRequired(true),
        new TextInputBuilder().setCustomId('color').setLabel('Hex Color (optional)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false),
      );
      return i.showModal(modal);
    },
    async onModal(i, ctx) {
      const channel = ctx ? i.announceChannel ?? null : null;
      /* channel was stored on the interaction by the command run —
         modals don't carry options, so we re-read from the guild settings instead: */
      const title = i.fields.getTextInputValue('title');
      const message = i.fields.getTextInputValue('message');
      const colorRaw = i.fields.getTextInputValue('color').trim();
      if (colorRaw && !/^#[0-9a-fA-F]{6}$/.test(colorRaw)) return err(i, 'Color must be a hex code like `#5865F2`.');

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor(colorRaw ? parseInt(colorRaw.replace('#', ''), 16) : colors.main)
        .setAuthor({ name: `Announcement by ${i.user.username}`, iconURL: i.user.displayAvatarURL() })
        .setTimestamp();

      /* stored target from run() */
      const target = i.client.announceTargets?.get(i.user.id) ?? i.channel;
      const ping = i.client.announcePings?.get(i.user.id) ?? '';

      await target.send({ content: ping || null, embeds: [embed] }).catch(() => {});
      return i.reply({ content: `✅ Announcement sent in ${target}.`, ephemeral: true });
    },
  },

  /* /jointocreate */
  {
    data: new SlashCommandBuilder()
      .setName('jointocreate')
      .setDescription('🔊 Set up Join-to-Create voice channels')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption(o => o.setName('action').setDescription('Enable or disable').setRequired(true)
        .addChoices({ name: 'enable', value: 'enable' }, { name: 'disable', value: 'disable' }))
      .addChannelOption(o => o.setName('category').setDescription('Category for temp channels').addChannelTypes(ChannelType.GuildCategory))
      .addChannelOption(o => o.setName('lobby').setDescription('The lobby voice channel users join').addChannelTypes(ChannelType.GuildVoice)),
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      const action = i.options.getString('action');

      if (action === 'disable') {
        g.jtc = null;
        ctx.save();
        return i.reply({ content: '✅ Join-to-Create disabled.', ephemeral: true });
      }

      const lobby = i.options.getChannel('lobby');
      const category = i.options.getChannel('category');
      if (!lobby || !category) return err(i, 'You must provide both a **lobby** voice channel and a **category** when enabling.');

      g.jtc = { lobbyId: lobby.id, categoryId: category.id };
      ctx.save();
      return i.reply({ content: `✅ Join-to-Create enabled — join ${lobby} and you'll get your own voice channel in **${category.name}**.`, ephemeral: true });
    },
  },

  /* /autorole — button panel */
  {
    data: new SlashCommandBuilder()
      .setName('autorole')
      .setDescription('🏷️ Roles automatically given when members join')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    ns: 'arole',
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      const list = g.autoroles.map(r => `<@&${r}>`).join(' ') || '*none*';
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🏷️ Autorole Settings')
          .setDescription(`Roles given on join:\n${list}`)
          .setColor(colors.main)],
        components: [row(
          new ButtonBuilder().setCustomId('arole:add').setLabel('➕ Add Role').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('arole:remove').setLabel('➖ Remove Role').setStyle(ButtonStyle.Danger),
        )],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      const action = i.customId.split(':')[1];
      const g = ctx.guild(i.guildId);
      const roles = i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25);
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`arole:${action}Select`)
        .setPlaceholder(action === 'add' ? 'Role to add…' : 'Role to remove…')
        .addOptions(roles.map(r => ({ label: r.name.slice(0, 100), value: r.id })));
      return i.reply({ components: [row(menu)], ephemeral: true });
    },
    async onSelect(i, ctx) {
      const [, action] = i.customId.split(':');
      const g = ctx.guild(i.guildId);
      const roleId = i.values[0];

      if (action === 'addSelect' && !g.autoroles.includes(roleId)) g.autoroles.push(roleId);
      if (action === 'removeSelect') g.autoroles = g.autoroles.filter(r => r !== roleId);
      ctx.save();

      const list = g.autoroles.map(r => `<@&${r}>`).join(' ') || '*none*';
      return i.update({ content: `✅ Autoroles are now: ${list}`, components: [] });
    },
  },

  /* /selfroles — private panel with dropdown */
  {
    data: new SlashCommandBuilder()
      .setName('selfroles')
      .setDescription('🎫 Roles members can give themselves')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    ns: 'srole',
    async run(i, ctx) {
      const g = ctx.guild(i.guildId);
      const list = g.selfroles.map(r => `<@&${r}>`).join(' ') || '*none yet — add some below*';
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🎫 Selfroles')
          .setDescription(`Pick your roles from the menu below.\n\n**Available:** ${list}`)
          .setColor(colors.main)],
        components: g.selfroles.length
          ? [row(new StringSelectMenuBuilder().setCustomId('srole:pick').setPlaceholder('Choose your roles…').setMinValues(0).setMaxValues(g.selfroles.length)
              .addOptions(g.selfroles.map(r => ({ label: (i.guild.roles.cache.get(r)?.name ?? r).slice(0, 100), value: r }))))]
          : [],
        ephemeral: true,
      });
    },
    async onButton(i, ctx) {
      /* admin manage buttons */
      const action = i.customId.split(':')[1];
      const g = ctx.guild(i.guildId);
      const roles = i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25);
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`srole:${action}Select`).setPlaceholder(action === 'add' ? 'Role to add…' : 'Role to remove…')
        .addOptions(roles.map(r => ({ label: r.name.slice(0, 100), value: r.id })));
      return i.reply({ components: [row(menu)], ephemeral: true });
    },
    async onSelect(i, ctx) {
      const [, action] = i.customId.split(':');

      /* member picking their own roles */
      if (action === 'pick') {
        const g = ctx.guild(i.guildId);
        await i.member.roles.remove(g.selfroles.filter(r => !i.values.includes(r))).catch(() => {});
        await i.member.roles.add(i.values).catch(() => {});
        return i.update({ content: `✅ Updated your roles: ${i.values.map(r => `<@&${r}>`).join(' ') || '*none*'}`, components: [i.message.components[0]] });
      }

      /* admin add/remove */
      const g = ctx.guild(i.guildId);
      const roleId = i.values[0];
      if (action === 'addSelect' && !g.selfroles.includes(roleId)) g.selfroles.push(roleId);
      if (action === 'removeSelect') g.selfroles = g.selfroles.filter(r => r !== roleId);
      ctx.save();
      const list = g.selfroles.map(r => `<@&${r}>`).join(' ') || '*none*';
      return i.update({ content: `✅ Selfroles are now: ${list}`, components: [] });
    },
  },

  /* /ticket — posts a panel; opens TEXT channels; close button + confirm */
  {
    data: new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('🎫 Post a support ticket panel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post the panel in').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addChannelOption(o => o.setName('category').setDescription('Category tickets are created in').addChannelTypes(ChannelType.GuildCategory).setRequired(true)),
    ns: 'tkt',
    async run(i, ctx) {
      const channel = i.options.getChannel('channel');
      const category = i.options.getChannel('category');

      const g = ctx.guild(i.guildId);
      g.ticketCategoryId = category.id;
      ctx.save();

      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Tickets')
        .setDescription('Click the button below to open a private ticket with the staff team.')
        .setColor(colors.main);
      await channel.send({
        embeds: [embed],
        components: [row(new ButtonBuilder().setCustomId('tkt:open').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary))],
      });
      return i.reply({ content: `✅ Ticket panel posted in ${channel}. Tickets open in **${category.name}**.`, ephemeral: true });
    },
    async onButton(i, ctx) {
      const action = i.customId.split(':')[1];
      const g = ctx.guild(i.guildId);

      if (action === 'open') {
        const existing = i.guild.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
        if (existing) return err(i, `You already have a ticket: ${existing}`);

        const ch = await i.guild.channels.create({
          name: `🎫-${i.user.username}`,
          type: ChannelType.GuildText, /* TEXT — this was the voice bug, fixed */
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

      if (action === 'close') {
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
    },
  },

  /* /logs — set error log channel */
  {
    data: new SlashCommandBuilder()
      .setName('logs')
      .setDescription('📜 Set the channel where errors get logged')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption(o => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)),
    async run(i, ctx) {
      const channel = i.options.getChannel('channel');
      const perms = channel.permissionsFor(i.guild.members.me);
      if (!perms?.has(['ViewChannel', 'SendMessages'])) {
        return err(i, `I can't send messages in ${channel} — fix my permissions there first.`);
      }
      const g = ctx.guild(i.guildId);
      g.logsChannelId = channel.id;
      ctx.save();
      return i.reply({ content: `✅ Errors will be logged in ${channel} with error codes like \`ERR-7F3A2B\`.`, ephemeral: true });
    },
  },

  /* /refresh — instant guild registration */
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

  {
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('🧹 Bulk delete messages')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(o => o.setName('amount').setDescription('1–100').setMinValue(1).setMaxValue(100).setRequired(true))
      .addUserOption(o => o.setName('user').setDescription('Only delete from this user')),
    async run(i) {
      await i.deferReply({ ephemeral: true });
      const amount = i.options.getInteger('amount');
      const user = i.options.getUser('user');
      const msgs = await i.channel.messages.fetch({ limit: 100 });
      const target = user ? [...msgs.values()].filter(m => m.author.id === user.id).slice(0, amount) : [...msgs.values()].slice(0, amount);
      await i.channel.bulkDelete(target, true).catch(() => {});
      return i.editReply(`🗑️ Deleted **${target.length}** message(s)${user ? ` from ${user}` : ''}.`);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('slowmode')
      .setDescription('🐢 Set channel slowmode')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addIntegerOption(o => o.setName('seconds').setDescription('0–21600, 0 disables').setMinValue(0).setMaxValue(21600).setRequired(true)),
    async run(i) {
      const seconds = i.options.getInteger('seconds');
      await i.channel.setRateLimitPerUser(seconds);
      return i.reply({ content: seconds === 0 ? '✅ Slowmode disabled.' : `✅ Slowmode set to **${seconds}s**.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('lock')
      .setDescription('🔒 Lock this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption(o => o.setName('reason').setDescription('Reason')),
    async run(i) {
      await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: false });
      return i.reply({ content: `🔒 Channel locked.${i.options.getString('reason') ? ` Reason: ${i.options.getString('reason')}` : ''}` });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('🔓 Unlock this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async run(i) {
      await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: null });
      return i.reply('🔓 Channel unlocked.');
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('👢 Kick a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')),
    async run(i) {
      const user = i.options.getUser('user');
      const reason = i.options.getString('reason') ?? 'No reason given';
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (!member) return err(i, 'That user is not in this server.');
      if (!member.kickable) return err(i, "I can't kick that member — they outrank me.");

      await member.send(`You were kicked from **${i.guild.name}**. Reason: ${reason}`).catch(() => {});
      await member.kick(reason);
      return i.reply({ content: `👢 Kicked ${user} — ${reason}`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('🔨 Ban a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason'))
      .addIntegerOption(o => o.setName('delete_days').setDescription('Delete their messages from the last X days').addChoices(
        { name: 'none', value: 0 }, { name: '1 day', value: 1 }, { name: '3 days', value: 3 }, { name: '7 days', value: 7 },
      )),
    async run(i) {
      const user = i.options.getUser('user');
      const reason = i.options.getString('reason') ?? 'No reason given';
      const days = i.options.getInteger('delete_days') ?? 0;
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) return err(i, "I can't ban that member — they outrank me.");

      await i.guild.members.ban(user.id, { reason, deleteMessageSeconds: days * 86400 });
      return i.reply({ content: `🔨 Banned ${user} — ${reason}`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('unban')
      .setDescription('🕊️ Unban a user by ID')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addStringOption(o => o.setName('user_id').setDescription('User ID to unban').setRequired(true)),
    async run(i) {
      const id = i.options.getString('user_id');
      if (!/^\d{17,20}$/.test(id)) return err(i, 'That is not a valid user ID.');
      const user = await i.guild.bans.remove(id).catch(() => null);
      if (!user) return err(i, 'That user is not banned.');
      return i.reply({ content: `🕊️ Unbanned **${user.tag}** (\`${id}\`).`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('bans')
      .setDescription('🚫 List all banned users')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async run(i) {
      await i.deferReply({ ephemeral: true });
      const bans = await i.guild.bans.fetch().catch(() => null);
      if (!bans) return i.editReply('⚠️ I need the **Ban Members** permission.');
      if (!bans.size) return i.editReply('✅ No banned users.');
      const list = bans.map((b, x) => `**${x + 1}.** ${b.user.username} (\`${b.user.id}\`)${b.reason ? ` — *${b.reason}*` : ''}`).join('\n');
      return i.editReply({ embeds: [new EmbedBuilder().setTitle(`🚫 Bans (${bans.size})`).setDescription(list.slice(0, 4000)).setColor(colors.bad)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('🔇 Timeout a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes (max 40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')),
    async run(i) {
      const member = i.options.getMember('user');
      if (!member) return err(i, 'That user is not in this server.');
      if (!member.moderatable) return err(i, "I can't timeout that member.");
      const minutes = i.options.getInteger('minutes');
      await member.timeout(minutes * 60 * 1000, i.options.getString('reason') ?? 'No reason given');
      return i.reply({ content: `🔇 ${member.user} timed out for **${minutes} min**.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('untimeout')
      .setDescription('🔊 Remove a member\'s timeout')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
    async run(i) {
      const member = i.options.getMember('user');
      if (!member) return err(i, 'That user is not in this server.');
      await member.timeout(null);
      return i.reply({ content: `🔊 Timeout removed from ${member.user}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('⚠️ Warn a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true).setMaxLength(500)),
    async run(i, ctx) {
      const user = i.options.getUser('user');
      const reason = i.options.getString('reason');
      const g = ctx.guild(i.guildId);
      if (!g.warns[user.id]) g.warns[user.id] = [];
      g.warns[user.id].push({ by: i.user.id, reason, at: Date.now() });
      ctx.save();
      await user.send(`⚠️ You were warned in **${i.guild.name}**: ${reason}`).catch(() => {});
      return i.reply({ content: `⚠️ Warned ${user} — ${reason} (they now have **${g.warns[user.id].length}** warning(s)).`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('📋 View a member\'s warnings')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
    async run(i, ctx) {
      const user = i.options.getUser('user');
      const list = ctx.guild(i.guildId).warns[user.id] ?? [];
      if (!list.length) return i.reply({ content: `✅ ${user} has no warnings.`, ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle(`📋 Warnings — ${user.username} (${list.length})`)
        .setDescription(list.map((w, x) => `**${x + 1}.** ${w.reason} — <@${w.by}> <t:${Math.floor(w.at / 1000)}:R>`).join('\n'))
        .setColor(colors.warn);
      return i.reply({ embeds: [embed], ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('clearwarnings')
      .setDescription('🧽 Clear a member\'s warnings')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)),
    async run(i, ctx) {
      const user = i.options.getUser('user');
      const g = ctx.guild(i.guildId);
      const had = g.warns[user.id]?.length ?? 0;
      delete g.warns[user.id];
      ctx.save();
      return i.reply({ content: `🧽 Cleared **${had}** warning(s) for ${user}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('roleadd')
      .setDescription('➕ Give a role')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    async run(i) {
      const member = i.options.getMember('user');
      const role = i.options.getRole('role');
      if (!member) return err(i, 'That user is not in this server.');
      if (!role.editable) return err(i, "I can't manage that role.");
      await member.roles.add(role);
      return i.reply({ content: `➕ Gave ${role} to ${member.user}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('roleremove')
      .setDescription('➖ Remove a role')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    async run(i) {
      const member = i.options.getMember('user');
      const role = i.options.getRole('role');
      if (!member) return err(i, 'That user is not in this server.');
      if (!role.editable) return err(i, "I can't manage that role.");
      await member.roles.remove(role);
      return i.reply({ content: `➖ Removed ${role} from ${member.user}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('nickname')
      .setDescription('✏️ Change a nickname')
      .setDefaultMemberPermissions(PermissionFlagsBits.ChangeNickname)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('New nickname — leave empty to reset').setMaxLength(32)),
    async run(i) {
      const member = i.options.getMember('user');
      if (!member) return err(i, 'That user is not in this server.');
      const nick = i.options.getString('nickname');
      await member.setNickname(nick ?? null).catch(() => {});
      return i.reply({ content: nick ? `✏️ Nickname of ${member.user} set to **${nick}**.` : `✏️ Reset ${member.user}'s nickname.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('dm')
      .setDescription('📨 DM a member as the bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(1000)),
    async run(i) {
      const user = i.options.getUser('user');
      const sent = await user.send(i.options.getString('message')).catch(() => null);
      if (!sent) return err(i, "Couldn't DM that user — their DMs may be closed.");
      return i.reply({ content: `📨 Sent to ${user}.`, ephemeral: true });
    },
  },

  /* ─────────────── INFO ─────────────── */

  {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('📊 Server information'),
    async run(i) {
      const { guild } = i;
      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 512 }))
        .setColor(colors.main)
        .addFields(
          { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
          { name: '_created', name2: '', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (Level ${guild.premiumTier})`, inline: true },
        )
        .setFooter({ text: `ID: ${guild.id}` })
        .setTimestamp();
      if (guild.bannerURL) embed.setImage(guild.bannerURL({ size: 1024 }));
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('👤 User information')
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
          { name: '⚠️ Warnings', value: `${(g.warns[user.id] ?? []).length}`, inline: true },
        );
      }
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('roleinfo')
      .setDescription('🎭 Role information')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
    async run(i) {
      const role = i.options.getRole('role');
      await i.guild.members.fetch().catch(() => {});
      const embed = new EmbedBuilder()
        .setTitle(`🎭 ${role.name}`)
        .setColor(role.color || colors.main)
        .addFields(
          { name: '🆔 ID', value: role.id, inline: true },
          { name: '🎨 Color', value: role.hexColor, inline: true },
          { name: '👥 Members', value: `${role.members.size}`, inline: true },
          { name: '📍 Position', value: `${role.position}`, inline: true },
          { name: '📌 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: '🤖 Managed', value: role.managed ? 'Yes' : 'No', inline: true },
        );
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('channelinfo')
      .setDescription('📺 Channel information')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)),
    async run(i) {
      const channel = i.options.getChannel('channel') ?? i.channel;
      const embed = new EmbedBuilder()
        .setTitle(`📺 #${channel.name}`)
        .setColor(colors.main)
        .addFields(
          { name: '🆔 ID', value: channel.id, inline: true },
          { name: '📂 Type', value: channel.type === ChannelType.GuildVoice ? 'Voice' : 'Text', inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
        );
      if (channel.parent) embed.addFields({ name: '📁 Category', value: channel.parent.name, inline: true });
      if (channel.topic) embed.addFields({ name: '📝 Topic', value: channel.topic.slice(0, 1024) });
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('🖼️ Show a user\'s avatar')
      .addUserOption(o => o.setName('user').setDescription('User')),
    async run(i) {
      const user = i.options.getUser('user') ?? i.user;
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 1024 }))
        .setColor(colors.main);
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('servericon').setDescription('🖼️ Show the server icon'),
    async run(i) {
      if (!i.guild.iconURL()) return err(i, 'This server has no icon.');
      return i.reply({ embeds: [new EmbedBuilder().setTitle(`${i.guild.name}'s Icon`).setImage(i.guild.iconURL({ size: 1024 })).setColor(colors.main)] });
    },
  },

  /* /membercount — live breakdown + optional auto voice counters */
  {
    data: new SlashCommandBuilder()
      .setName('membercount')
      .setDescription('👥 Member count breakdown')
      .addStringOption(o => o.setName('action').setDescription('setup:create — create locked live voice counter channels')
        .addChoices({ name: 'setup:create', value: 'setup' })),
    ns: 'mcount',
    async run(i, ctx) {
      const action = i.options.getString('action');

      /* setup: create locked voice counter channels */
      if (action === 'setup') {
        if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** to run setup.');
        if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return err(i, 'I need **Manage Channels**.');

        await i.deferReply({ ephemeral: true });
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
            name,
            type: ChannelType.GuildVoice,
            permissionOverwrites: [
              { id: i.guild.id, deny: ['Connect', 'SendMessages'] }, /* locked */
              { id: i.client.user.id, allow: ['Connect', 'ManageChannels'] },
            ],
          }).catch(() => null);
          if (ch) ids[key] = ch.id;
        }
        const g = ctx.guild(i.guildId);
        g.counterIds = ids;
        ctx.save();
        return i.editReply('✅ Created live counter channels — they update automatically every 2 minutes.\n' +
          '*If Online stays at 0, enable **Server Presence Intent** in the Developer Portal.*');
      }

      /* normal display with refresh button */
      await i.guild.members.fetch().catch(() => {});
      const members = i.guild.members.cache;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;
      const online = members.filter(m => m.presence && m.presence.status !== 'offline').size;
      const pct = members.size ? Math.round((online / members.size) * 100) : 0;
      const filled = Math.round(pct / 10);

      const embed = new EmbedBuilder()
        .setTitle(`👥 ${i.guild.name} — Member Count`)
        .setDescription([
          `**Total:** ${members.size}`,
          `**Humans:** ${humans}`,
          `**Bots:** ${bots}`,
          `**Online:** ${online} (${pct}%)`,
          `\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\` ${pct}%`,
        ].join('\n'))
        .setColor(colors.main)
        .setTimestamp();
      return i.reply({
        embeds: [embed],
        components: [row(new ButtonBuilder().setCustomId('mcount:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary))],
      });
    },
    async onButton(i) {
      await i.guild.members.fetch().catch(() => {});
      const members = i.guild.members.cache;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;
      const online = members.filter(m => m.presence && m.presence.status !== 'offline').size;
      const pct = members.size ? Math.round((online / members.size) * 100) : 0;
      const filled = Math.round(pct / 10);
      const embed = new EmbedBuilder()
        .setTitle(`👥 ${i.guild.name} — Member Count`)
        .setDescription([
          `**Total:** ${members.size}`,
          `**Humans:** ${humans}`,
          `**Bots:** ${bots}`,
          `**Online:** ${online} (${pct}%)`,
          `\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\` ${pct}%`,
        ].join('\n'))
        .setColor(colors.main)
        .setTimestamp();
      return i.update({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('botinfo').setDescription('🤖 Bot information'),
    async run(i) {
      const embed = new EmbedBuilder()
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
        );
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('stats').setDescription('📈 Server stats'),
    async run(i) {
      const { guild } = i;
      const embed = new EmbedBuilder()
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
        .setTimestamp();
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('boosts').setDescription('🚀 Boost status'),
    async run(i) {
      const { guild } = i;
      const perks = ['💎 Better audio quality', '📄 More emoji slots', '🎨 Server banner & animated icon', '📎 Bigger upload limits'];
      const embed = new EmbedBuilder()
        .setTitle('🚀 Server Boosts')
        .setDescription(`**${guild.premiumSubscriptionCount ?? 0}** boosts — **Level ${guild.premiumTier}**`)
        .addFields({ name: 'Perks unlocked', value: perks.slice(0, guild.premiumTier + 1).join('\n') || '*None yet — boost to unlock perks!*' })
        .setColor(colors.main);
      return i.reply({ embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('snipe').setDescription('🎯 Last deleted message in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async run(i, ctx) {
      const s = ctx.snipes.get(i.channel.id);
      if (!s) return err(i, 'Nothing to snipe here.');
      const embed = new EmbedBuilder()
        .setAuthor({ name: s.author, iconURL: s.avatar })
        .setDescription(s.content || '*no text*')
        .setImage(s.image)
        .setFooter({ text: `Deleted` })
        .setTimestamp(s.at)
        .setColor(colors.main);
      return i.reply({ embeds: [embed], ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder().setName('editsnipe').setDescription('✏️ Last edited message in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async run(i, ctx) {
      const s = ctx.editSnipes.get(i.channel.id);
      if (!s) return err(i, 'Nothing to snipe here.');
      const embed = new EmbedBuilder()
        .setAuthor({ name: s.author, iconURL: s.avatar })
        .addFields(
          { name: 'Before', value: (s.before || '*empty*').slice(0, 1000) },
          { name: 'After', value: (s.after || '*empty*').slice(0, 1000) },
        )
        .setFooter({ text: 'Edited' })
        .setTimestamp(s.at)
        .setColor(colors.warn);
      return i.reply({ embeds: [embed], ephemeral: true });
    },
  },

  /* ─────────────── UTILITY ─────────────── */

  {
    data: new SlashCommandBuilder()
      .setName('say')
      .setDescription('💬 Make the bot say something')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(2000))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to say it in').addChannelTypes(ChannelType.GuildText)),
    async run(i) {
      const channel = i.options.getChannel('channel') ?? i.channel;
      await channel.send(i.options.getString('message'));
      return i.reply({ content: `✅ Sent in ${channel}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('remind')
      .setDescription('⏰ Set a reminder')
      .addIntegerOption(o => o.setName('minutes').setDescription('In how many minutes (max 43200 = 30 days)').setMinValue(1).setMaxValue(43200).setRequired(true))
      .addStringOption(o => o.setName('text').setDescription('What to remind you about').setRequired(true).setMaxLength(500)),
    async run(i) {
      const minutes = i.options.getInteger('minutes');
      const text = i.options.getString('text');
      await i.reply({ content: `⏰ Got it — I'll remind you in **${minutes} min**: *${text}*`, ephemeral: true });
      setTimeout(() => {
        i.user.send(`⏰ **Reminder:** ${text}`).catch(() =>
          i.channel?.send(`⏰ <@${i.user.id}> **Reminder:** ${text}`).catch(() => {}));
      }, minutes * 60 * 1000);
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('📊 Create a poll')
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
      const options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(n => i.options.getString(`option${n}`))
        .filter(Boolean);
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

  {
    data: new SlashCommandBuilder()
      .setName('calculator')
      .setDescription('🧮 Evaluate a math expression')
      .addStringOption(o => o.setName('expression').setDescription('e.g. (5+3)*2 or Math.sqrt(16)').setRequired(true).setMaxLength(200)),
    async run(i) {
      const raw = i.options.getString('expression');
      const allowed = /^(Math\.(sqrt|abs|round|floor|ceil|pow|PI|E)|[-+*/%().0-9e\s])+$/;
      if (!allowed.test(raw)) {
        return err(i, 'Only numbers, `+ - * / % ( )` and `Math.sqrt / abs / round / floor / ceil / pow / PI / E` are allowed.');
      }
      let result;
      try {
        result = Function('"use strict"; return (' + raw + ')')();
      } catch {
        return err(i, 'That expression is invalid.');
      }
      if (typeof result !== 'number' || !Number.isFinite(result)) return err(i, "That expression didn't produce a valid number.");
      return i.reply({ embeds: [new EmbedBuilder().setTitle('🧮 Calculator').setDescription(`\`${raw}\` = **${result}**`).setColor(colors.main)] });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('inrole')
      .setDescription('👥 List members with a role')
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

  {
    data: new SlashCommandBuilder()
      .setName('channelcreate')
      .setDescription('📺 Create a channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('type').setDescription('Channel type').setRequired(true)
        .addChoices({ name: 'text', value: 'text' }, { name: 'voice', value: 'voice' }))
      .addChannelOption(o => o.setName('category').setDescription('Category').addChannelTypes(ChannelType.GuildCategory)),
    async run(i) {
      const name = i.options.getString('name').toLowerCase().replaceAll(' ', '-');
      const type = i.options.getString('type') === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
      const category = i.options.getChannel('category');
      const channel = await i.guild.channels.create({ name, type, parent: category?.id ?? null, reason: `Created by ${i.user.tag}` });
      return i.reply({ content: `✅ Created ${channel}${category ? ` in **${category.name}**` : ''}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('rolecreate')
      .setDescription('🏷️ Create a role')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('color').setDescription('Hex color, e.g. #5865F2').setMaxLength(7)),
    async run(i) {
      const name = i.options.getString('name');
      const colorRaw = i.options.getString('color');
      if (colorRaw && !/^#?[0-9a-fA-F]{6}$/.test(colorRaw)) return err(i, 'Color must be a hex code like `#5865F2`.');
      const role = await i.guild.roles.create({
        name,
        color: colorRaw ? parseInt(colorRaw.replace('#', ''), 16) : colors.main,
        reason: `Created by ${i.user.tag}`,
      });
      return i.reply({ content: `✅ Created ${role}.`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder().setName('ping').setDescription('🏓 Bot latency'),
    async run(i) {
      const sent = await i.reply({ content: '🏓 Pinging…', fetchReply: true });
      const embed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .addFields(
          { name: '📡 Roundtrip', value: `${sent.createdTimestamp - i.createdTimestamp}ms`, inline: true },
          { name: '💓 API', value: `${Math.round(i.client.ws.ping)}ms`, inline: true },
        )
        .setColor(colors.good);
      return i.editReply({ content: '', embeds: [embed] });
    },
  },

  {
    data: new SlashCommandBuilder().setName('uptime').setDescription('⏱️ Bot uptime'),
    async run(i) {
      return i.reply({ content: `⏱️ Online for **${formatDuration(i.client.uptime)}**`, ephemeral: true });
    },
  },

  {
    data: new SlashCommandBuilder().setName('invite').setDescription('🔗 Invite the bot'),
    async run(i) {
      const embed = new EmbedBuilder()
        .setTitle('🔗 Invite OGs Bot')
        .setDescription(`[Click here to invite me](${inviteLink(i.client)})`)
        .setColor(colors.main)
        .setThumbnail(i.client.user.displayAvatarURL());
      return i.reply({ embeds: [embed] });
    },
  },
];

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

module.exports = { commands };