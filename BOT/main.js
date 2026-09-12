const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const commands = require('./commands.js');

/* ═══════════════ STORAGE ═══════════════ */
const dbFile = './data.json';
const db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : {};
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const guild = id => db[id] ??= { welcome: {}, goodbye: {}, jtc: {}, autoroles: [], warns: {}, afk: {}, tickets: [] };
const hex = c => parseInt(String(c).replace('#', ''), 16);

/* in-memory state */
const snipes = new Map();          // channelId -> last deleted message
const editSnipes = new Map();      // channelId -> last edited message

/* everything commands are allowed to touch, passed as (interaction, ctx) */
const ctx = {
  db, save, guild, hex, snipes, editSnipes,
  EmbedBuilder, config,
  colors: { ok: '#57F287', main: '#5865F2', warn: '#FEE75C', bad: '#ED4245' },
};

/* ═══════════════ CLIENT ═══════════════ */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});

/* namespace -> command (for button/modal routing) */
const byNs = new Map(commands.filter(c => c.ns).map(c => [c.ns, c]));

/* ═══════════════ COMMAND REGISTRATION (instant, per-guild) ═══════════════ */
const registerGuild = async g => {
  try {
    await g.commands.set(commands.map(c => c.data.toJSON ? c.data.toJSON() : c.data));
    console.log(`✅ Commands registered in ${g.name}`);
  } catch (err) { console.error(`Registration failed in ${g.name}:`, err); }
};

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag} — ${commands.length} commands`);
  for (const g of client.guilds.cache.values()) await registerGuild(g);
  await client.application.commands.set(commands.map(c => c.data.toJSON ? c.data.toJSON() : c.data)).catch(console.error);
});

client.on('guildCreate', registerGuild);

/* ═══════════════ EVENTS ═══════════════ */

/* member join: autorole + welcome */
client.on('guildMemberAdd', async member => {
  const g = guild(member.guild.id);
  for (const roleId of g.autoroles) await member.roles.add(roleId).catch(() => {});

  const w = g.welcome;
  if (w?.enabled && w.channelId) {
    const text = (w.message ?? '').replaceAll('{user}', `<@${member.id}>`)
      .replaceAll('{username}', member.user.username)
      .replaceAll('{server}', member.guild.name)
      .replaceAll('{membercount}', String(member.guild.memberCount));
    const e = EmbedBuilder.from({ title: w.title ?? '👋 Welcome!', description: text || 'Welcome to {server}!', })
      .setColor(hex(w.color ?? '#5865F2'))
      .setThumbnail(w.pfp ?? member.user.displayAvatarURL())
      .setFooter({ text: `Member #${member.guild.memberCount}` }).setTimestamp();
    if (w.banner) e.setImage(w.banner);
    await member.guild.channels.cache.get(w.channelId)?.send({ content: text || undefined, embeds: [e] }).catch(() => {});
  }
});

/* member leave: goodbye */
client.on('guildMemberRemove', async member => {
  const c = guild(member.guild.id).goodbye;
  if (!c?.enabled || !c.channelId) return;
  const text = (c.message ?? '{username} left {server}.').replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
  const e = EmbedBuilder.from({ title: c.title ?? '🚪 Goodbye', description: text })
    .setColor(hex(c.color ?? '#ED4245'))
    .setThumbnail(c.pfp ?? member.user.displayAvatarURL()).setTimestamp();
  if (c.banner) e.setImage(c.banner);
  await member.guild.channels.cache.get(c.channelId)?.send({ content: text.startsWith('<@') ? undefined : text, embeds: [e] }).catch(() => {});
});

/* join-to-create voice */
client.on('voiceStateUpdate', async (oldState, newState) => {
  const cfg = guild(newState.guild.id).jtc;

  /* joined lobby -> temp channel */
  if (newState.channelId === cfg.lobbyId && newState.channelId !== oldState.channelId) {
    const temp = await newState.guild.channels.create({
      name: `${newState.member.user.username}'s Channel`,
      type: 2,
      parent: cfg.categoryId,
      permissionOverwrites: [{ id: newState.member.id, allow: ['ManageChannels', 'MoveMembers', 'MuteMembers', 'DeafenMembers'] }],
    }).catch(() => null);
    if (!temp) return;
    await newState.member.voice.setChannel(temp).catch(() => temp.delete());
  }

  /* empty temp channel -> delete */
  if (oldState.channelId && oldState.channelId !== cfg.lobbyId &&
      oldState.channel?.parentId === cfg.categoryId &&
      oldState.channel.members.size === 0) {
    await oldState.channel.delete().catch(() => {});
  }
});

/* snipe storage */
client.on('messageDelete', msg => {
  if (!msg.guild || msg.author?.bot) return;
  snipes.set(msg.channel.id, { author: msg.author.tag, avatar: msg.author.displayAvatarURL(), content: msg.content, image: msg.attachments.first()?.url, at: Date.now() });
});
client.on('messageUpdate', (oldM, newM) => {
  if (!newM.guild || newM.author?.bot || oldM.content === newM.content) return;
  editSnipes.set(newM.channel.id, { author: newM.author.tag, avatar: newM.author.displayAvatarURL(), before: oldM.content, after: newM.content, at: Date.now() });
});

/* ═══════════════ INTERACTION ROUTER ═══════════════ */
const fail = async interaction => {
  const r = { content: '⚠️ Something went wrong.', ephemeral: true };
  try { interaction.replied || interaction.deferred ? interaction.followUp(r) : interaction.reply(r); } catch {}
};

client.on('interactionCreate', async interaction => {
  try {
    /* slash commands */
    if (interaction.isChatInputCommand()) {
      const cmd = commands.find(c => (c.data.name ?? c.data.name) === interaction.commandName);
      if (!cmd) return;
      return await cmd.run(interaction, ctx);
    }

    /* route buttons & modals & selects by namespace prefix */
    const rawId = interaction.customId;
    const ns = rawId.split(':')[0];
    const owner = byNs.get(ns);
    if (!owner) return;

    if (interaction.isButton() && owner.onButton) return await owner.onButton(interaction, ctx);
    if (interaction.isModalSubmit() && owner.onModal) return await owner.onModal(interaction, ctx);
    if (interaction.isStringSelectMenu() && owner.onSelect) return await owner.onSelect(interaction, ctx);
  } catch (err) {
    console.error(err);
    await fail(interaction);
  }
});

client.login(config.token);