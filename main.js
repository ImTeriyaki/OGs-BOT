const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

// ---- tiny JSON storage ----
const dbFile = './data.json';
const db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : {};
function save() { fs.writeFileSync(dbFile, JSON.stringify(db, null, 2)); }
function getGuild(id) { return db[id] ||= { welcome: {}, goodbye: {}, announce: {}, jtc: {} }; }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.GuildMember],
});

client.commands = new Collection();
const commands = [];

// ============ /welcome & /goodbye settings ============
function settingsCommand(type) {
  return {
    data: {
      name: type,
      description: `Configure the ${type} message`,
      options: [
        { name: 'channel', type: 7, description: 'Channel for the message', required: true, channel_types: [0] },
        { name: 'title', type: 3, description: 'Embed title', required: false },
        { name: 'message', type: 3, description: 'Message text. Placeholders: {user} {username} {server} {membercount}', required: false },
        { name: 'banner_url', type: 3, description: 'Image URL shown as the big banner', required: false },
        { name: 'pfp_url', type: 3, description: 'Image URL shown as thumbnail/pfp', required: false },
        { name: 'color', type: 3, description: 'Hex color like #5865F2', required: false },
        { name: 'enabled', type: 5, description: 'Enable or disable', required: false },
      ],
      // executed below
    },
    async run(interaction) {
      const g = getGuild(interaction.guild.id);
      const opts = interaction.options;
      g[type] = {
        enabled: opts.getBoolean('enabled') ?? g[type].enabled ?? true,
        channelId: opts.getChannel('channel').id,
        title: opts.getString('title') ?? g[type].title ?? null,
        message: opts.getString('message') ?? g[type].message ??
          (type === 'welcome' ? 'Welcome {user} to {server}! You are member #{membercount}' : '{username} has left {server}.'),
        banner: opts.getString('banner_url') ?? g[type].banner ?? null,
        pfp: opts.getString('pfp_url') ?? g[type].pfp ?? null,
        color: opts.getString('color') ?? g[type].color ?? '#5865F2',
      };
      save();
      await interaction.reply({ content: `${type} settings saved.`, ephemeral: true });
    },
  };
}

commands.push(settingsCommand('welcome'), settingsCommand('goodbye'));

// ============ /announce ============
commands.push({
  data: {
    name: 'announce',
    description: 'Send an announcement (optionally scheduled)',
    options: [
      { name: 'channel', type: 7, description: 'Target channel', required: true, channel_types: [0] },
      { name: 'message', type: 3, description: 'Announcement text', required: true },
      { name: 'title', type: 3, description: 'Embed title (makes it an embed)', required: false },
      { name: 'banner_url', type: 3, description: 'Image URL for the embed', required: false },
      { name: 'color', type: 3, description: 'Hex color', required: false },
      { name: 'ping', type: 3, description: 'Ping role', choices: [
        { name: 'everyone', value: 'everyone' },
        { name: 'here', value: 'here' },
        { name: 'none', value: 'none' },
      ]},
      { name: 'delay_minutes', type: 4, description: 'Schedule: send in X minutes (optional)', required: false, min_value: 1 },
    ],
  },
  async run(interaction) {
    const opts = interaction.options;
    const payload = {
      content: { everyone: '@everyone', here: '@here', none: null }[opts.getString('ping') ?? 'none'],
      embeds: [{
        title: opts.getString('title') ?? '📢 Announcement',
        description: opts.getString('message'),
        color: parseInt((opts.getString('color') ?? '#5865F2').replace('#', ''), 16),
        image: opts.getString('banner_url') ? { url: opts.getString('banner_url') } : null,
        footer: { text: `Announced by ${interaction.user.tag}` },
        timestamp: new Date().toISOString(),
      }],
      allowedMentions: { parse: ['everyone'] },
    };

    const delay = opts.getInteger('delay_minutes');
    if (delay) {
      await interaction.reply({ content: `Scheduled — will be posted in **${delay} min** in <#${opts.getChannel('channel').id}>.`, ephemeral: true });
      setTimeout(() => {
        client.channels.fetch(opts.getChannel('channel').id)
          .then(ch => ch.send(payload))
          .catch(console.error);
      }, delay * 60_000);
    } else {
      await opts.getChannel('channel').send(payload);
      await interaction.reply({ content: 'Announcement sent.', ephemeral: true });
    }
  },
});

// ============ /jointocreate setup ============
commands.push({
  data: {
    name: 'jointocreate',
    description: 'Set up Join-to-Create voice channels',
    options: [
      { name: 'category', type: 7, description: 'Category to create temp channels in', required: true, channel_types: [4] },
      { name: 'channel_name', type: 3, description: 'Name of the JTC lobby channel', required: false },
    ],
  },
  async run(interaction) {
    const g = getGuild(interaction.guild.id);
    const name = interaction.options.getString('channel_name') ?? '➕ Join to Create';
    const lobby = await interaction.guild.channels.create({
      name, type: 2, parent: interaction.options.getChannel('category').id,
    });
    g.jtc = { lobbyId: lobby.id, categoryId: lobby.parentId };
    save();
    await interaction.reply({ content: `JTC lobby created: ${lobby}. Anyone joining gets their own channel.`, ephemeral: true });
  },
});

// ============ register slash commands ============
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const body = commands.map(c => ({ name: c.data.name, description: c.data.description, options: c.data.options }));
  await client.application.commands.set(body);
  console.log('Slash commands registered.');
});

// ============ events ============
function fill(template, member) {
  return template
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}

client.on('guildMemberAdd', async member => {
  const cfg = getGuild(member.guild.id).welcome;
  if (!cfg?.enabled) return;
  const ch = member.guild.channels.cache.get(cfg.channelId);
  if (!ch) return;
  await ch.send({
    content: fill(cfg.message ?? '', member),
    embeds: [{
      title: cfg.title ?? '👋 Welcome!',
      description: fill(cfg.message ?? 'Welcome!', member),
      color: parseInt((cfg.color ?? '#5865F2').replace('#', ''), 16),
      thumbnail: (cfg.pfp ?? member.user.displayAvatarURL()) ? { url: cfg.pfp ?? member.user.displayAvatarURL() } : null,
      image: cfg.banner ? { url: cfg.banner } : null,
      footer: { text: `Member #${member.guild.memberCount}` },
    }],
  });
});

client.on('guildMemberRemove', async member => {
  const cfg = getGuild(member.guild.id).goodbye;
  if (!cfg?.enabled) return;
  const ch = member.guild.channels.cache.get(cfg.channelId);
  if (!ch) return;
  await ch.send({
    content: fill(cfg.message ?? '', member),
    embeds: [{
      title: cfg.title ?? '🚪 Goodbye',
      description: fill(cfg.message ?? 'Someone left.', member),
      color: parseInt((cfg.color ?? '#ED4245').replace('#', ''), 16),
      thumbnail: { url: cfg.pfp ?? member.user.displayAvatarURL() },
      image: cfg.banner ? { url: cfg.banner } : null,
    }],
  });
});

// Join-to-Create
client.on('voiceStateUpdate', async (oldState, newState) => {
  const jtc = getGuild(newState.guild.id).jtc;

  // user joined the lobby -> make them a channel
  if (newState.channelId === jtc.lobbyId && newState.channelId !== oldState.channelId) {
    const temp = await newState.guild.channels.create({
      name: `${newState.member.user.username}'s Channel`,
      type: 2,
      parent: jtc.categoryId,
      permissionOverwrites: [
        {
          id: newState.member.id,
          allow: ['ManageChannels', 'MoveMembers', 'MuteMembers', 'DeafenMembers'],
        },
      ],
    });
    await newState.member.voice.setChannel(temp).catch(() => temp.delete());
  }

  // temp channel empty -> delete it
  if (oldState.channelId && oldState.channelId !== jtc.lobbyId &&
      oldState.channel?.parentId === jtc.categoryId &&
      oldState.channel.members.size === 0) {
    await oldState.channel.delete().catch(() => {});
  }
});

// command router
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = commands.find(c => c.data.name === interaction.commandName);
  if (!cmd) return;
  try { await cmd.run(interaction); } catch (e) {
    console.error(e);
    const reply = { content: 'Something went wrong.', ephemeral: true };
    interaction.replied ? interaction.followUp(reply) : interaction.reply(reply);
  }
});

client.login(config.token);