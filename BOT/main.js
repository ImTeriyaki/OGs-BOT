const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, Events, ChannelType,
} = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { commands, registerHoneypot, registerDmMessages } = require('./commands.js');

/* ═══════════════ STORAGE ═══════════════ */
const DB_PATH = path.join(__dirname, '..', 'data.json');
let db = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {};

function defaultGuild() {
  return {
    welcome: {}, goodbye: {}, tickets: {}, jtc: null,
    warns: {}, afk: {}, autoroles: [], selfroles: [],
    logsChannelId: null, counterIds: null,
  };
}

const store = {
  guild(id) {
    if (!db[id]) db[id] = defaultGuild();
    /* backfill missing keys for old data files */
    for (const [key, value] of Object.entries(defaultGuild())) {
      if (db[id][key] === undefined) db[id][key] = value;
    }
    return db[id];
  },
  save() { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); },
};

/* in-memory state */
const snipes = new Map();     // channelId -> last deleted message
const editSnipes = new Map(); // channelId -> last edited message

/* ═══════════════ CLIENT ═══════════════ */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

/* everything commands are allowed to touch, passed as (interaction, ctx) */
const ctx = {
  guild: store.guild,
  save: store.save,
  snipes,
  editSnipes,
  client,
};

/* namespace -> command (for button/modal/select routing) */
const byNs = new Map(commands.filter(c => c.ns).map(c => [c.ns, c]));

/* ═══════════════ ERROR HANDLER ═══════════════ */
/* generates a short error code, replies privately, never crashes,
   and logs to the guild's configured logs channel */
async function handleError(interaction, error, source = 'command') {
  const code = 'ERR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[${code}] (${source}):`, error);

  if (interaction) {
    const payload = {
      content: `⚠️ Something went wrong.\n**Error code:** \`${code}\`\n*The error has been logged.*`,
      ephemeral: true,
    };
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch { /* ignore */ }
  }

  /* log to the guild's logs channel if configured */
  if (interaction?.guildId) {
    const guildData = store.guild(interaction.guildId);
    if (guildData.logsChannelId) {
      const channel = await client.channels.fetch(guildData.logsChannelId).catch(() => null);
      if (channel) {
        const logEmbed = new EmbedBuilder()
          .setTitle(`🚨 ${code}`)
          .setDescription([
            `**» Source** \`${source}\``,
            interaction.commandName ? `**» Command** \`/${interaction.commandName}\`` : null,
            interaction.user ? `**» User** <@${interaction.user.id}>` : null,
            `**» Channel** <#${interaction.channelId}>`,
          ].filter(Boolean).join('\n'))
          .addFields({ name: 'Error', value: `\`\`\`\n${String(error?.stack ?? error).slice(0, 1000)}\n\`\`\`` })
          .setColor(0xED4245)
          .setTimestamp();
        await channel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }
  }
}

/* never terminate on unexpected async errors */
process.on('unhandledRejection', (error) => handleError(null, error, 'unhandledRejection'));
process.on('uncaughtException', (error) => console.error('uncaughtException:', error));
client.on('error', (error) => console.error('Client error:', error));
client.on('shardError', (error) => console.error('Shard error:', error));

/* ═══════════════ COMMAND REGISTRATION ═══════════════ */
/* THE duplication fix:
   - guild scope is the ONLY scope commands are registered into (instant)
   - the global scope is only ever CLEARED (set([])), never filled        */

const registerGuild = async (g) => {
  try {
    await g.commands.set(commands.map(c => c.data.toJSON()));
    console.log(`✅ Registered ${commands.length} commands in ${g.name}`);
  } catch (err) {
    console.error(`Registration failed in ${g.name}:`, err);
  }
};

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag} — ${commands.length} commands`);

  /* ONE-TIME global wipe — removes old duplicate global commands.
     Comment this block out after it has run once and ~1 hour has passed. */
  try {
    await readyClient.application.commands.set([]);
    console.log('🧹 Global commands cleared (old duplicates will fade within ~1 hour)');
  } catch (err) {
    console.error('Failed to clear global commands:', err);
  }

  for (const g of readyClient.guilds.cache.values()) await registerGuild(g);
  updateCounters().catch(() => {});
});

client.on(Events.GuildCreate, registerGuild);

/* ═══════════════ EVENTS ═══════════════ */

/* member join: autorole + welcome + counters */
client.on(Events.GuildMemberAdd, async (member) => {
  const g = store.guild(member.guild.id);

  for (const roleId of g.autoroles) {
    const role = member.guild.roles.cache.get(roleId);
    if (role && role.editable) await member.roles.add(role).catch(() => {});
  }

  const w = g.welcome;
  if (w?.enabled && w.channelId) {
    const text = (w.message ?? 'Welcome to {server}!')
      .replaceAll('{user}', `<@${member.id}>`)
      .replaceAll('{username}', member.user.username)
      .replaceAll('{server}', member.guild.name)
      .replaceAll('{membercount}', String(member.guild.memberCount));
    const embed = new EmbedBuilder()
      .setTitle(w.title ?? '👋 Welcome!')
      .setDescription(text)
      .setColor(w.color ? parseInt(w.color.replace('#', ''), 16) : 0x5865F2)
      .setThumbnail(w.pfp ?? member.user.displayAvatarURL())
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();
    if (w.banner) embed.setImage(w.banner);
    await member.guild.channels.cache.get(w.channelId)?.send({ embeds: [embed] }).catch(() => {});
  }

  updateCounters().catch(() => {});
});

/* member leave: goodbye + counters */
client.on(Events.GuildMemberRemove, async (member) => {
  const c = store.guild(member.guild.id).goodbye;
  if (c?.enabled && c.channelId) {
    const text = (c.message ?? '{username} left {server}.')
      .replaceAll('{user}', `<@${member.id}>`)
      .replaceAll('{username}', member.user.username)
      .replaceAll('{server}', member.guild.name)
      .replaceAll('{membercount}', String(member.guild.memberCount));
    const embed = new EmbedBuilder()
      .setTitle(c.title ?? '🚪 Goodbye')
      .setDescription(text)
      .setColor(c.color ? parseInt(c.color.replace('#', ''), 16) : 0xED4245)
      .setThumbnail(c.pfp ?? member.user.displayAvatarURL())
      .setTimestamp();
    if (c.banner) embed.setImage(c.banner);
    await member.guild.channels.cache.get(c.channelId)?.send({ embeds: [embed] }).catch(() => {});
  }

  updateCounters().catch(() => {});
});

/* join-to-create voice */
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const g = store.guild(newState.guild.id);
  const cfg = g.jtc;
  if (!cfg?.lobbyId) return;

  /* joined the lobby -> create a temp channel and move them in */
  if (newState.channelId === cfg.lobbyId && newState.channelId !== oldState.channelId) {
    const temp = await newState.guild.channels.create({
      name: `🔊 ${newState.member.user.username}'s Channel`,
      type: ChannelType.GuildVoice,
      parent: cfg.categoryId ?? null,
      permissionOverwrites: [
        { id: newState.member.id, allow: ['ManageChannels', 'MoveMembers', 'MuteMembers', 'DeafenMembers'] },
      ],
    }).catch(() => null);
    if (!temp) return;
    await newState.member.voice.setChannel(temp).catch(() => temp.delete().catch(() => {}));
  }

  /* empty temp channel -> delete */
  if (oldState.channelId
    && oldState.channelId !== cfg.lobbyId
    && oldState.channel?.parentId === cfg.categoryId
    && oldState.channel.members.size === 0
    && oldState.channel.name.endsWith("'s Channel")) {
    await oldState.channel.delete().catch(() => {});
  }
});

/* snipe storage */
client.on(Events.MessageDelete, (msg) => {
  if (!msg.guild || msg.author?.bot) return;
  snipes.set(msg.channel.id, {
    author: msg.author.username,
    avatar: msg.author.displayAvatarURL(),
    content: msg.content,
    image: msg.attachments.first()?.url ?? null,
    at: Date.now(),
  });
});
client.on(Events.MessageUpdate, (oldM, newM) => {
  if (!newM.guild || newM.author?.bot || oldM.content === newM.content) return;
  editSnipes.set(newM.channel.id, {
    author: newM.author.username,
    avatar: newM.author.displayAvatarURL(),
    before: oldM.content,
    after: newM.content,
    at: Date.now(),
  });
});

/* AFK notice + auto-clear */
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  const g = store.guild(message.guild.id);

  for (const userId of message.mentions.users.keys()) {
    if (g.afk?.[userId]) {
      await message.channel.send(`😴 <@${userId}> is AFK: *${g.afk[userId]}*`).catch(() => {});
    }
  }

  if (g.afk?.[message.author.id]) {
    delete g.afk[message.author.id];
    store.save();
    await message.reply('☀️ Welcome back — your AFK status was cleared.').catch(() => {});
  }
});

/* honeypot engine lives in commands.js — silent in trap channels,
   log channel + DM only */
registerHoneypot(client, ctx);

/* welcome-DM engine also lives in commands.js — sends the configured
   greeting as a DM when welcome "DM Greeting" is enabled */
registerDmMessages(client, ctx);

/* ═══════════════ LIVE MEMBER COUNT CHANNELS ═══════════════ */
async function updateCounters() {
  for (const [guildId, data] of Object.entries(db)) {
    if (!data.counterIds) continue;
    const g = client.guilds.cache.get(guildId);
    if (!g) continue;
    await g.members.fetch().catch(() => {});
    const members = g.members.cache;
    const names = {
      total: `👥 Total: ${members.size}`,
      humans: `🧑 Humans: ${members.filter(m => !m.user.bot).size}`,
      bots: `🤖 Bots: ${members.filter(m => m.user.bot).size}`,
      online: `🟢 Online: ${members.filter(m => m.presence && m.presence.status !== 'offline').size}`,
    };
    for (const [key, channelId] of Object.entries(data.counterIds)) {
      const channel = g.channels.cache.get(channelId);
      if (channel && channel.name !== names[key]) {
        await channel.setName(names[key]).catch(() => {});
      }
    }
  }
}
setInterval(() => updateCounters().catch(() => {}), 2 * 60 * 1000); // every 2 minutes

/* presence updates fire constantly — throttle counters to once per minute */
let presenceDirty = false;
setInterval(() => {
  if (presenceDirty) {
    presenceDirty = false;
    updateCounters().catch(() => {});
  }
}, 60 * 1000);
client.on(Events.PresenceUpdate, () => { presenceDirty = true; });

/* ═══════════════ INTERACTION ROUTER ═══════════════ */
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    /* slash commands */
    if (interaction.isChatInputCommand()) {
      const cmd = commands.find(c => c.data.name === interaction.commandName);
      if (!cmd) return;
      return await cmd.run(interaction, ctx);
    }

    /* route buttons / modals / selects by namespace prefix */
    const ns = interaction.customId.split(':')[0];
    const owner = byNs.get(ns);
    if (!owner) return;

    if (interaction.isButton() && owner.onButton) return await owner.onButton(interaction, ctx);
    if (interaction.isModalSubmit() && owner.onModal) return await owner.onModal(interaction, ctx);
    if (interaction.isAnySelectMenu() && owner.onSelect) return await owner.onSelect(interaction, ctx);
  } catch (err) {
    await handleError(interaction, err, 'router');
  }
});

/* ═══════════════ LOGIN ═══════════════ */
const token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
  console.error('Missing DISCORD_TOKEN. Add it to a .env file in the project root.');
  process.exitCode = 1;
} else {
  client.login(token).catch((error) => handleError(null, error, 'login'));
}