const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, menu, textChannels, categories } = require('./_shared');

/* ═══════════════════════════ AUTO-FORWARD CLIPS (routes) ═══════════════════════════ */
/* Video-clip-only auto forwarder with named ROUTES.
   Each route has its own detection mode:
     ⚡ Auto      — forward immediately on detection
     ❓ Ask First — post a ✅ Forward / ❌ Skip confirmation in the source channel */

const AFWD_DEFAULTS = () => ({
  enabled: false,
  routes: [],
  blacklist: [],
  forwardCount: 0,
});

const AFWD_MSG_DEFAULT = '🎬 {user} sent this clip';
const afNewRoute = () => ({
  id: Math.random().toString(36).slice(2, 8),
  name: 'New Route',
  categoryIds: [],
  channelIds: [],
  destinationChannelId: null,
  deleteOriginal: false,
  mode: 'auto',                       // 'auto' | 'ask'
  confirmMessage: AFWD_MSG_DEFAULT,
});

function afState(g) {
  const a = g.autoforward ??= AFWD_DEFAULTS();
  a.routes ??= [];
  a.blacklist ??= [];
  for (const r of a.routes) r.mode ??= 'auto';
  return a;
}

/* ── video detection ── */
const AFWD_VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mpg', 'mpeg', 'wmv', 'flv', '3gp'];
const AFWD_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'];

/* content-type cache: attachment id -> is-video boolean (from HEAD probe) */
const afCtCache = new Map();

function afwdIsVideo(att) {
  if (!att) return false;
  const ct = (att.contentType ?? '').toLowerCase();
  if (ct) {
    if (ct.startsWith('video/')) return true;
    if (ct.startsWith('image/')) return false;
    /* unknown-but-present content type (e.g. application/octet-stream)
       falls through — many Medal/clip exports ship as octet-stream */
  }
  const ext = (att.name ?? '').split('.').pop().toLowerCase();
  if (AFWD_IMAGE_EXT.includes(ext)) return false;
  if (AFWD_VIDEO_EXT.includes(ext)) return true;
  /* no video extension / no useful content type → caller may probe the URL */
  return null;
}

/* final fallback: ask Discord's CDN what the file actually is.
   A cached PNG/GIF URL returns "not video" forever; a real mp4 returns video/*. */
async function afwdProbeIsVideo(att) {
  if (afCtCache.has(att.id)) return afCtCache.get(att.id);
  let isVideo = false;
  try {
    const res = await fetch(att.url, { method: 'HEAD' });
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    isVideo = ct.startsWith('video/');
    if (!ct || ct === 'application/octet-stream') {
      /* CDN didn't say — last resort: file extension in the CDN URL */
      const urlExt = (new URL(att.url).pathname.split('.').pop() ?? '').toLowerCase();
      isVideo = AFWD_VIDEO_EXT.includes(urlExt);
    }
  } catch { /* network hiccup → treat as not-a-clip */ }
  afCtCache.set(att.id, isVideo);
  if (afCtCache.size > 1000) afCtCache.clear();
  return isVideo;
}

async function afwdVideosIn(msg) {
  /* plain attachments only — never embeds (Tenor/Giphy), never stickers */
  const out = [];
  for (const att of msg.attachments.values()) {
    const verdict = afwdIsVideo(att);
    if (verdict === true) { out.push(att); continue; }
    if (verdict === false) continue;               /* confirmed image → never */
    if (await afwdProbeIsVideo(att)) out.push(att); /* unknown → probe the CDN */
  }
  return out;
}

/* ── pasted video links (not uploaded files) ── */
const AFWD_URL_RE = /https?:\/\/[^\s<>"']+/gi;
const AFWD_VIDEO_FILE_RE = new RegExp(`\\.(${AFWD_VIDEO_EXT.join('|')})(\\?\\S*)?$`, 'i');
const AFWD_VIDEO_HOST_RE = [
  /youtube\.com\/(watch\?|shorts\/)/i,
  /youtu\.be\//i,
  /streamable\.com\//i,
  /medal\.tv\/(clips|games)\//i,
  /clips\.twitch\.tv\/\S+/i,
  /twitch\.tv\/[^/\s]+\/clip\//i,
];

function afwdVideoLinksIn(msg) {
  const urls = msg.content?.match(AFWD_URL_RE) ?? [];
  return urls.filter(u => AFWD_VIDEO_FILE_RE.test(u) || AFWD_VIDEO_HOST_RE.some(re => re.test(u)));
}

/* which route handles a clip posted in this channel? */
function afwdMatchRoute(a, msg) {
  for (const r of a.routes) {
    if (r.channelIds?.includes(msg.channelId) && r.destinationChannelId) return r;
  }
  const parentId = msg.channel?.parentId ?? null;
  if (parentId) {
    for (const r of a.routes) {
      if (r.categoryIds?.includes(parentId) && r.destinationChannelId) return r;
    }
  }
  return null;
}

/* ── panels ── */
function afRoutePanel(r) {
  return [
    row(
      new ButtonBuilder().setCustomId(`afwd:rname:${r.id}`).setLabel('✏️ Name').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`afwd:rcats:${r.id}`).setLabel('📁 Categories').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`afwd:rchans:${r.id}`).setLabel('📺 Source Channels').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`afwd:rdest:${r.id}`).setLabel('🎯 Destination').setStyle(ButtonStyle.Success),
    ),
    row(
      new ButtonBuilder().setCustomId(`afwd:rmode:${r.id}`)
        .setLabel(r.mode === 'ask' ? '❓ Mode: Ask First' : '⚡ Mode: Auto-Forward')
        .setStyle(r.mode === 'ask' ? ButtonStyle.Primary : ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`afwd:rdelete:${r.id}`).setLabel(`🗑️ Delete Original: ${r.deleteOriginal ? 'On' : 'Off'}`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`afwd:rmsg:${r.id}`).setLabel('💬 Forward Message').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`afwd:rtest:${r.id}`).setLabel('🧪 Test').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId(`afwd:rremove:${r.id}`).setLabel('❌ Delete This Route').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('afwd:back').setLabel('⬅️ Back to Dashboard').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function afRouteEmbed(i, g, r) {
  const cats = r.categoryIds.length ? r.categoryIds.map(c => {
    const cat = i.guild.channels.cache.get(c);
    return cat ? `\`${cat.name}\`` : '`deleted`';
  }).join(', ') : '*none*';
  const chans = r.channelIds.length ? r.channelIds.map(c => `<#${c}>`).join(', ') : '*none*';
  const mode = r.mode === 'ask'
    ? '❓ **Ask First** — detected clips get a ✅ Forward / ❌ Skip prompt in the source channel'
    : '⚡ **Auto** — detected clips are forwarded immediately';
  return new EmbedBuilder()
    .setTitle(`🎬 Route: ${r.name}`)
    .setDescription(
      `**Categories:** ${cats}\n`
      + `**Source Channels:** ${chans}\n`
      + `**Destination:** ${r.destinationChannelId ? `<#${r.destinationChannelId}>` : '*not set*'}\n`
      + `**Mode:** ${mode}\n`
      + `**Delete Original:** ${r.deleteOriginal ? '✅ Enabled' : '❌ Disabled'}\n`
      + `**Forward Message:** \`${(r.confirmMessage ?? AFWD_MSG_DEFAULT).slice(0, 60)}\`\n\n`
      + '*A clip is sent to this route when posted in one of its source channels\n(most specific) or inside one of its categories.*',
    )
    .setColor(colors.main)
    .setFooter({ text: 'Video clips only — images/GIFs/stickers are never forwarded' });
}

function afDashboardEmbed(i, g) {
  const a = afState(g);
  const bl = a.blacklist.length ? a.blacklist.map(c => `<#${c}>`).join(', ') : '*none*';
  const routes = a.routes.length
    ? a.routes.map((r, x) =>
      `**${x + 1}. ${r.name}** ${r.mode === 'ask' ? '❓' : '⚡'}\n`
      + `　🎯 ${r.destinationChannelId ? `<#${r.destinationChannelId}>` : '*no destination*'}\n`
      + `　📁 ${r.categoryIds.length} categor${r.categoryIds.length === 1 ? 'y' : 'ies'} • 📺 ${r.channelIds.length} source channel${r.channelIds.length === 1 ? '' : 's'}`).join('\n')
    : '*none — add your first route below*';
  return new EmbedBuilder()
    .setTitle('🎬 Auto-Forward Clips')
    .setDescription(
      '**Video clips only** — images, GIFs (Discord/Tenor/Giphy), stickers and screenshots are never forwarded.\n\n'
      + `**Status:** ${a.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n`
      + `**Blacklisted (global):** ${bl}\n`
      + `**Clips forwarded:** ${a.forwardCount}\n\n`
      + `**Routes (${a.routes.length}):**  ⚡ = auto-forward  •  ❓ = ask first\n${routes}`,
    )
    .setColor(a.enabled ? colors.good : colors.main)
    .setFooter({ text: 'Supported: uploaded video files + pasted YouTube/Streamable/Medal/Twitch-clip links & direct video URLs' });
}

function afDashboardPanel(a) {
  return [
    row(
      new ButtonBuilder().setCustomId('afwd:toggle').setLabel(a.enabled ? '⬇️ Disable' : '🚀 Enable').setStyle(a.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('afwd:add').setLabel('➕ Add Route').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('afwd:edit').setLabel('🛠️ Edit Route').setStyle(ButtonStyle.Primary).setDisabled(!a.routes.length),
    ),
    row(
      new ButtonBuilder().setCustomId('afwd:blacklist').setLabel('⛔ Global Blacklist').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('afwd:view').setLabel('👁️ View Config').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('afwd:reset').setLabel('♻️ Reset').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('afwd:close').setLabel('✖️').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

const command = {
  data: new SlashCommandBuilder()
    .setName('autoforward')
    .setDescription('🎬 Auto-Forward Clips — route video clips to private/public clip channels (video only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'afwd',

  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const a = afState(g);
    ctx.save();
    return i.reply({ embeds: [afDashboardEmbed(i, g)], components: afDashboardPanel(a), ephemeral: true });
  },

  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const a = afState(g);
    const [, action, routeId] = i.customId.split(':');

    /* ── dashboard-level buttons ── */
    if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }
    if (action === 'back') return i.update({ embeds: [afDashboardEmbed(i, g)], components: afDashboardPanel(a) });

    if (action === 'toggle') {
      const ready = a.routes.some(r => r.destinationChannelId);
      if (!ready) return err(i, 'Create at least one route with a **destination channel** first.');
      a.enabled = !a.enabled;
      ctx.save();
      return i.update({ embeds: [afDashboardEmbed(i, g)], components: afDashboardPanel(a) });
    }

    if (action === 'view') return i.reply({ embeds: [afDashboardEmbed(i, g)], ephemeral: true });

    if (action === 'add') {
      if (a.routes.length >= 10) return err(i, 'Route limit reached (10). Remove one first.');
      const r = afNewRoute();
      a.routes.push(r);
      ctx.save();
      return i.update({ embeds: [afRouteEmbed(i, g, r)], components: afRoutePanel(r) });
    }

    if (action === 'edit') {
      if (!a.routes.length) return err(i, 'No routes yet — add one first.');
      const sel = menu('afwd:editSel', '🛠️ Pick a route to edit…',
        a.routes.map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🎬' })));
      return i.reply({ content: '🛠️ Which route do you want to configure?', components: [row(sel)], ephemeral: true });
    }

    if (action === 'blacklist') {
      const chans = textChannels(i);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId('afwd:blSel')
        .setPlaceholder('⛔ Channels where clips are ignored everywhere…')
        .setMinValues(0).setMaxValues(Math.min(chans.length, 25))
        .addOptions(chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: a.blacklist.includes(c.id) })));
      return i.reply({
        content: '⛔ These channels are ignored by **all** routes (overrides everything). Selection replaces the list.',
        components: [row(sel)], ephemeral: true,
      });
    }

    if (action === 'reset') {
      g.autoforward = AFWD_DEFAULTS();
      ctx.save();
      return i.update({ embeds: [afDashboardEmbed(i, g)], components: afDashboardPanel(afState(g)) });
    }

    /* ── per-route buttons ── */
    const r = a.routes.find(x => x.id === routeId);
    if (!r) return err(i, 'That route no longer exists.');

    if (action === 'rname') {
      const modal = new ModalBuilder().setCustomId(`afwd:rnameModal:${r.id}`).setTitle('Route Name');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Route name (e.g. Private / Public)')
        .setStyle(TextInputStyle.Short).setMaxLength(50).setValue(r.name).setRequired(true)));
      return i.showModal(modal);
    }

    if (action === 'rmsg') {
      const modal = new ModalBuilder().setCustomId(`afwd:rmsgModal:${r.id}`).setTitle('Forward Message');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Message ({user} = sender)')
        .setStyle(TextInputStyle.Short).setMaxLength(200)
        .setValue(r.confirmMessage ?? AFWD_MSG_DEFAULT).setRequired(true)));
      return i.showModal(modal);
    }

    if (action === 'rmode') {
      r.mode = r.mode === 'ask' ? 'auto' : 'ask';
      ctx.save();
      return i.update({ embeds: [afRouteEmbed(i, g, r)], components: afRoutePanel(r) });
    }

    if (action === 'rdelete') {
      r.deleteOriginal = !r.deleteOriginal;
      ctx.save();
      return i.update({ embeds: [afRouteEmbed(i, g, r)], components: afRoutePanel(r) });
    }

    if (action === 'rcats') {
      const cats = categories(i, 25);
      if (!cats.length) return err(i, 'No categories found.');
      const sel = new StringSelectMenuBuilder().setCustomId(`afwd:rCatSel:${r.id}`)
        .setPlaceholder('📁 Categories whose clips go to this route (multi-select)…')
        .setMinValues(0).setMaxValues(Math.min(cats.length, 25))
        .addOptions(cats.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁', default: r.categoryIds.includes(c.id) })));
      return i.reply({
        content: `📁 **${r.name}** — select all categories (multi-select). Selection replaces the list.`,
        components: [row(sel)], ephemeral: true,
      });
    }

    if (action === 'rchans') {
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId(`afwd:rChanSel:${r.id}`)
        .setPlaceholder('📺 Specific source channels (multi-select)…')
        .setMinValues(0).setMaxValues(Math.min(chans.length, 25))
        .addOptions(chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: r.channelIds.includes(c.id) })));
      return i.reply({
        content: `📺 **${r.name}** — optional specific source channels. They beat category matching. Selection replaces the list.`,
        components: [row(sel)], ephemeral: true,
      });
    }

    if (action === 'rdest') {
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = menu(`afwd:rDestSel:${r.id}`, '🎯 Where clips from this route land…',
        chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🎯', default: c.id === r.destinationChannelId })));
      return i.reply({ content: `🎯 **${r.name}** — pick the destination clip channel:`, components: [row(sel)], ephemeral: true });
    }

    if (action === 'rtest') {
      const dest = r.destinationChannelId && await i.guild.channels.fetch(r.destinationChannelId).catch(() => null);
      if (!dest) return err(i, 'Set a valid destination first.');
      if (!a.enabled) return err(i, 'The system is disabled — enable it on the dashboard first.');
      await dest.send({
        embeds: [new EmbedBuilder().setTitle(`🧪 Route Test — ${r.name}`)
          .setDescription(`✅ Clips matching this route will land here.\n**Mode:** ${r.mode === 'ask' ? '❓ Ask First' : '⚡ Auto-Forward'}\n**Categories:** ${r.categoryIds.length} • **Source channels:** ${r.channelIds.length}`)
          .setColor(colors.good)],
      }).catch(() => {});
      return i.reply({ content: `🧪 Test message sent in ${dest}.`, ephemeral: true });
    }

    if (action === 'rremove') {
      a.routes = a.routes.filter(x => x.id !== r.id);
      ctx.save();
      return i.update({ content: `❌ Route **${r.name}** deleted.`, embeds: [afDashboardEmbed(i, g)], components: afDashboardPanel(a) });
    }
  },

  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    const a = afState(g);
    const [, action, routeId] = i.customId.split(':');

    if (action === 'editSel') {
      const r = a.routes.find(x => x.id === i.values[0]);
      if (!r) return err(i, 'That route no longer exists.');
      return i.update({ embeds: [afRouteEmbed(i, g, r)], components: afRoutePanel(r) });
    }

    if (action === 'blSel') { a.blacklist = i.values; ctx.save(); return i.update({ content: `⛔ Blacklist: ${a.blacklist.length ? a.blacklist.map(c => `<#${c}>`).join(', ') : '*empty*'}`, components: [] }); }

    const r = a.routes.find(x => x.id === routeId);
    if (!r) return err(i, 'That route no longer exists.');

    if (action === 'rCatSel') {
      r.categoryIds = i.values;
      ctx.save();
      return i.update({ content: `📁 **${r.name}** categories: ${r.categoryIds.length ? r.categoryIds.map(c => {
        const cat = i.guild.channels.cache.get(c);
        return cat ? `\`${cat.name}\`` : null;
      }).filter(Boolean).join(', ') : '*none*'}`, components: [] });
    }
    if (action === 'rChanSel') {
      r.channelIds = i.values;
      ctx.save();
      return i.update({ content: `📺 **${r.name}** source channels: ${r.channelIds.length ? r.channelIds.map(c => `<#${c}>`).join(', ') : '*none*'}`, components: [] });
    }
    if (action === 'rDestSel') {
      r.destinationChannelId = i.values[0];
      ctx.save();
      return i.update({ content: `🎯 **${r.name}** clips will land in <#${r.destinationChannelId}>.`, components: [] });
    }
  },

  async onModal(i, ctx) {
    const g = ctx.guild(i.guildId);
    const a = afState(g);
    const [, action, routeId] = i.customId.split(':');
    const r = a.routes.find(x => x.id === routeId);
    if (!r) return err(i, 'That route no longer exists.');

    if (action === 'rnameModal') {
      r.name = i.fields.getTextInputValue('v');
      ctx.save();
      return i.reply({ content: `✏️ Route renamed to **${r.name}**.`, ephemeral: true });
    }
    if (action === 'rmsgModal') {
      r.confirmMessage = i.fields.getTextInputValue('v');
      ctx.save();
      return i.reply({ content: `✅ Forward message for **${r.name}** set:\n> ${r.confirmMessage.replaceAll('{user}', i.user.toString())}`, ephemeral: true });
    }
  },
};

/* ═══════════════════ auto-forward engine (messageCreate + ask-confirm buttons) ═══════════════════ */

/* shared: actually forward a message's videos to a route's destination.
   returns the count forwarded, or -1 when nothing could be sent. */
async function afwdDoForward(msg, route, ctx) {
  const dest = await msg.guild.channels.fetch(route.destinationChannelId).catch(() => null);
  if (!dest?.isTextBased()) return -1;
  if (msg.channelId === dest.id) return -1;

  const mePerms = msg.guild.members.me?.permissionsIn(dest);
  if (!mePerms?.has(PermissionFlagsBits.SendMessages) || !mePerms?.has(PermissionFlagsBits.AttachFiles)) return -1;

  const videos = await afwdVideosIn(msg);
  const links = afwdVideoLinksIn(msg);
  if (!videos.length && !links.length) return -1;

  const base = (route.confirmMessage ?? AFWD_MSG_DEFAULT).replaceAll('{user}', `<@${msg.author.id}>`);
  let sentCount = 0;
  const failed = [];

  /* pasted links — one message per link so each gets its own Discord embed/unfurl */
  for (const url of links) {
    try {
      await dest.send({ content: `${base}\n${url}` });
      sentCount++;
    } catch { /* rate-limited etc. — link stays in the original message */ }
  }

  /* uploaded files — re-upload, one message per file */
  for (const att of videos) {
    try {
      await dest.send({ content: base, files: [{ attachment: att.url, name: att.name }] });
      sentCount++;
    } catch {
      failed.push(att); /* oversize, rate-limited, expired URL — original stays intact */
    }
  }

  if (sentCount) {
    const g = ctx.guild(msg.guildId);
    const a = afState(g);
    a.forwardCount = (a.forwardCount ?? 0) + sentCount;
    ctx.save();
    if (route.deleteOriginal) await msg.delete().catch(() => {});
  }
  if (failed.length) {
    await msg.channel.send({
      content: `⚠️ <@${msg.author.id}> — ${failed.length} clip(s) couldn't be forwarded (too large or upload failed). Your original message is untouched.`,
    }).catch(() => {});
  }
  return sentCount;
}

function registerAutoForward(client, ctx) {
  /* message-id dedupe — the same message can never be processed twice */
  const seenMessages = new Set();
  /* pending "ask first" confirmations: msgId -> { routeId, at, promptMsgId } */
  const pendingAsks = new Map();

  client.on('messageCreate', async (msg) => {
    try {
      /* loop prevention: never process the bot's own (or any bot's) messages */
      if (!msg.guild || !msg.author || msg.author.bot) return;
      if (msg.webhookId) return;

      const g = ctx.guild(msg.guildId);
      const a = g ? afState(g) : null;
      if (!a?.enabled || !a.routes.length) return;
      if (a.blacklist.includes(msg.channelId)) return;

      /* video-only check: uploaded files (with CDN probe for Medal clips etc.)
         plus pasted links (YouTube, Streamable, Medal, Twitch clips, direct video URLs) */
      const videos = await afwdVideosIn(msg);
      const links = afwdVideoLinksIn(msg);
      if (!videos.length && !links.length) return;

      const route = afwdMatchRoute(a, msg);
      if (!route) return;

      if (seenMessages.has(msg.id)) return;
      seenMessages.add(msg.id);
      if (seenMessages.size > 500) for (const id of seenMessages) { seenMessages.delete(id); if (seenMessages.size <= 250) break; }

      /* ── ASK FIRST mode: post confirmation prompt instead of forwarding ── */
      if (route.mode === 'ask') {
        const prompt = await msg.reply({
          content: `🎬 <@${msg.author.id}> sent **${videos.length + links.length}** video clip(s). Forward to <#${route.destinationChannelId}>?`,
          components: [row(
            new ButtonBuilder().setCustomId(`afwd:askYes:${msg.id}:${route.id}`).setLabel('✅ Forward').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`afwd:askNo:${msg.id}`).setLabel('❌ Skip').setStyle(ButtonStyle.Secondary),
          )],
        }).catch(() => null);
        if (prompt) {
          pendingAsks.set(msg.id, { routeId: route.id, at: Date.now(), promptMsgId: prompt.id });
          /* auto-expire stale prompts after 10 minutes */
          for (const [id, p] of pendingAsks) {
            if (Date.now() - p.at > 10 * 60 * 1000) {
              pendingAsks.delete(id);
              msg.channel.messages.delete(p.promptMsgId).catch(() => {});
            }
          }
        }
        return;
      }

      /* ── AUTO mode: forward immediately ── */
      await afwdDoForward(msg, route, ctx);
    } catch { /* never crash the bot over auto-forward */ }
  });

  /* ── ask-confirm button handlers ── */
  client.on('interactionCreate', async (btn) => {
    try {
      if (!btn.isButton() || !btn.customId.startsWith('afwd:ask')) return;

      if (btn.customId.startsWith('afwd:askNo:')) {
        pendingAsks.delete(btn.customId.split(':')[2]);
        await btn.update({ content: '❌ Skipped — the clip stays here.', components: [] }).catch(() => {});
        return;
      }

      /* askYes */
      const [, , msgId, routeId] = btn.customId.split(':');
      const pending = pendingAsks.get(msgId);
      if (!pending) return btn.update({ content: '⌛ This prompt expired. The clip is still in its original message.', components: [] }).catch(() => {});

      const g = ctx.guild(btn.guildId);
      const a = afState(g);
      const route = a.routes.find(r => r.id === routeId);
      if (!route?.destinationChannelId) return btn.update({ content: '⚠️ The route was removed — cannot forward.', components: [] }).catch(() => {});

      await btn.update({ content: `⏳ Forwarding to <#${route.destinationChannelId}>…`, components: [] }).catch(() => {});
      const srcMsg = await btn.channel.messages.fetch(msgId).catch(() => null);
      if (!srcMsg) return;

      const count = await afwdDoForward(srcMsg, route, ctx);
      pendingAsks.delete(msgId);
      if (count > 0) {
        await btn.channel.send(`✅ ${btn.user} forwarded **${count}** clip(s) to <#${route.destinationChannelId}>.`).catch(() => {});
      }
    } catch { /* never crash */ }
  });
}

module.exports = { command, registerAutoForward };
