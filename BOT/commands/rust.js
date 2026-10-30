const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { colors, row, err } = require('./_shared');

/* ═══════════════════════════ /rust — wipe countdown via BattleMetrics ═══════════════════════════
   Needs a free BattleMetrics API token in .env as BATTLEMETRICS_API_KEY
   (battlemetrics.com/developers → Personal Access Tokens → New Token, no org restriction —
   BattleMetrics now rejects unauthenticated requests entirely).

   BattleMetrics doesn't expose a server's actual wipe schedule, only its last detected wipe —
   "Next Wipe" / "Next Force Wipe" here are estimates based on the standard Rust convention
   (weekly on Thursday, force/BP wipe on the first Thursday of the month), clearly labeled as such. */

const BM_BASE = 'https://api.battlemetrics.com';
const THURSDAY = 4;
const WIPE_HOUR_UTC = 14;

async function bmFetch(path) {
  const key = process.env.BATTLEMETRICS_API_KEY?.trim();
  if (!key) throw new Error('NO_KEY');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${BM_BASE}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: controller.signal });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.errors?.[0]?.detail || `BattleMetrics HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchRustServers(query, limit = 25) {
  const qs = new URLSearchParams({ 'filter[game]': 'rust', 'filter[search]': query, 'page[size]': String(limit), sort: '-players' });
  const json = await bmFetch(`/servers?${qs}`);
  return json.data ?? [];
}

async function getServer(id) {
  const json = await bmFetch(`/servers/${id}`);
  return json.data ?? null;
}

/* next occurrence of `weekday` (0=Sun..6=Sat) at `hourUTC`, strictly after `from` */
function nextWeekdayAt(from, weekday, hourUTC) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hourUTC, 0, 0));
  let diff = (weekday - d.getUTCDay() + 7) % 7;
  if (diff === 0 && d <= from) diff = 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/* first `weekday` of the next month that hasn't already passed */
function nextForceWipe(from, weekday, hourUTC) {
  const firstOfMonth = (y, m) => {
    const d = new Date(Date.UTC(y, m, 1, hourUTC, 0, 0));
    d.setUTCDate(d.getUTCDate() + (weekday - d.getUTCDay() + 7) % 7);
    return d;
  };
  let d = firstOfMonth(from.getUTCFullYear(), from.getUTCMonth());
  if (d <= from) d = firstOfMonth(from.getUTCFullYear(), from.getUTCMonth() + 1);
  return d;
}

function ts(date) { return Math.floor(date.getTime() / 1000); }

/* g.rust may be a leftover partial shape from before notifyChannelId/lastWipeSeen existed —
   backfill per-field rather than relying on defaultGuild()'s shallow top-level-only merge */
function rustState(g) {
  g.rust ??= {};
  g.rust.mainServerId ??= null;
  g.rust.notifyChannelId ??= null;
  g.rust.lastWipeSeen ??= null;
  return g.rust;
}

function rustEmbed(server, isMain) {
  const a = server.attributes;
  const now = new Date();
  const nextWipe = ts(nextWeekdayAt(now, THURSDAY, WIPE_HOUR_UTC));
  const nextForce = ts(nextForceWipe(now, THURSDAY, WIPE_HOUR_UTC));
  const lastWipeRaw = a.details?.rust_last_wipe;
  const lastWipe = lastWipeRaw ? ts(new Date(lastWipeRaw)) : null;
  const online = a.status === 'online';
  const queued = a.details?.rust_queued_players;

  const summary = [
    online ? '🟢 **Online**' : '🔴 **Offline**',
    `👥 **${a.players}/${a.maxPlayers}**${queued ? ` (+${queued} queued)` : ''}`,
    a.rank ? `📊 Rank **#${a.rank}**` : '📊 *Unranked*',
  ].join('   •   ');

  return new EmbedBuilder()
    .setTitle(`🎮 ${a.name}`)
    .setURL(`https://www.battlemetrics.com/servers/rust/${server.id}`)
    .setColor(online ? colors.good : colors.bad)
    .setDescription(`${isMain ? '⭐ *Main tracked server*\n\n' : ''}${summary}`)
    .addFields(
      ...(lastWipe ? [{ name: '🗺️ Last Wipe', value: `<t:${lastWipe}:F>\n<t:${lastWipe}:R>` }] : []),
      { name: '🔄 Next Wipe', value: `<t:${nextWipe}:F>\n<t:${nextWipe}:R>`, inline: true },
      { name: '💥 Next Force Wipe', value: `<t:${nextForce}:F>\n<t:${nextForce}:R>`, inline: true },
    )
    .setFooter({ text: "Next wipe times are estimated (Thursdays, ~14:00 UTC) — BattleMetrics only reports the last detected wipe, not a server's configured schedule." });
}

function rustButtons(serverId, isMain, canSetMain) {
  return row(
    new ButtonBuilder().setCustomId(`rust:refresh:${serverId}`).setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
    ...(canSetMain && !isMain ? [new ButtonBuilder().setCustomId(`rust:setmain:${serverId}`).setLabel('⭐ Set as Main Server').setStyle(ButtonStyle.Success)] : []),
  );
}

const NO_KEY_MSG = '⚠️ BattleMetrics isn\'t configured yet. Get a free API key at <https://www.battlemetrics.com/developers> '
  + '(Personal Access Tokens → New Token — leave it unrestricted by organization), add `BATTLEMETRICS_API_KEY=yourtoken` '
  + "to the bot's `.env` file, then restart the bot.";

const WIPE_POLL_MS = 5 * 60 * 1000;

function rustWipeEmbed(server) {
  const a = server.attributes;
  const lastWipe = ts(new Date(a.details.rust_last_wipe));
  return new EmbedBuilder()
    .setTitle(`🔄 ${a.name} just wiped!`)
    .setURL(`https://www.battlemetrics.com/servers/rust/${server.id}`)
    .setColor(colors.good)
    .addFields(
      { name: 'Wiped', value: `<t:${lastWipe}:F> (<t:${lastWipe}:R>)`, inline: true },
      { name: 'Players Online', value: `${a.players}/${a.maxPlayers}`, inline: true },
    );
}

/* polls each guild's main Rust server for BattleMetrics' detected last-wipe timestamp and
   announces in the configured channel the moment it moves forward. The first poll after
   both a main server and a notify channel are set only seeds lastWipeSeen — it never
   announces a wipe that already happened before alerts were turned on. */
function registerRustWipeWatcher(client, ctx) {
  async function checkAll() {
    for (const guild of client.guilds.cache.values()) {
      const g = ctx.guild(guild.id);
      const r = rustState(g);
      if (!r.mainServerId || !r.notifyChannelId) continue;

      let server;
      try { server = await getServer(r.mainServerId); } catch { continue; }
      const lastWipeRaw = server?.attributes?.details?.rust_last_wipe;
      if (!lastWipeRaw) continue;

      const lastWipeMs = new Date(lastWipeRaw).getTime();
      if (r.lastWipeSeen !== null && lastWipeMs <= r.lastWipeSeen) continue;
      const seeding = r.lastWipeSeen === null;
      r.lastWipeSeen = lastWipeMs;
      ctx.save();
      if (seeding) continue;

      const channel = await guild.channels.fetch(r.notifyChannelId).catch(() => null);
      if (!channel?.isTextBased()) continue;
      await channel.send({ content: '🔔 **Wipe detected!**', embeds: [rustWipeEmbed(server)] }).catch(() => {});
    }
  }
  checkAll().catch(() => {});
  setInterval(() => checkAll().catch(() => {}), WIPE_POLL_MS);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rust')
    .setDescription('Rust server wipe countdown & live player count (BattleMetrics)')
    .addStringOption(o => o.setName('server').setDescription("Search a Rust server (blank = this server's main tracked server)").setAutocomplete(true).setRequired(false)),
  ns: 'rust',

  async autocomplete(i) {
    const focused = i.options.getFocused();
    if (!focused || focused.trim().length < 2) return i.respond([]).catch(() => {});
    try {
      const results = await searchRustServers(focused.trim(), 10);
      return i.respond(results.map(s => ({
        name: `${s.attributes.name} (${s.attributes.players}/${s.attributes.maxPlayers})`.slice(0, 100),
        value: s.id,
      }))).catch(() => {});
    } catch {
      return i.respond([]).catch(() => {});
    }
  },

  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const r = rustState(g);
    const query = i.options.getString('server')?.trim();
    await i.deferReply();

    try {
      let serverId = query;
      if (!query) {
        if (!r.mainServerId) {
          return i.editReply('⚠️ No main Rust server is configured yet. Search for one with `/rust server:<name>` (pick a suggestion), then click **⭐ Set as Main Server**.');
        }
        serverId = r.mainServerId;
      } else if (!/^\d+$/.test(query)) {
        /* user typed free text instead of picking an autocomplete suggestion */
        const results = await searchRustServers(query, 1);
        if (!results.length) return i.editReply(`⚠️ No Rust servers found matching **${query}**.`);
        serverId = results[0].id;
      }

      const server = await getServer(serverId);
      if (!server) return i.editReply('⚠️ That server could not be found on BattleMetrics.');

      const isMain = server.id === r.mainServerId;
      const canSetMain = i.member.permissions.has(PermissionFlagsBits.ManageGuild);
      return i.editReply({ embeds: [rustEmbed(server, isMain)], components: [rustButtons(server.id, isMain, canSetMain)] });
    } catch (e) {
      return i.editReply(e.message === 'NO_KEY' ? NO_KEY_MSG : `⚠️ BattleMetrics error: ${e.message}`);
    }
  },

  async onButton(i, ctx) {
    const [, action, id] = i.customId.split(':');
    const g = ctx.guild(i.guildId);
    const r = rustState(g);

    if (action === 'setmain') {
      if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** to set the main Rust server.');
      r.mainServerId = id;
      r.lastWipeSeen = null; // re-seed on next poll instead of carrying over the old server's wipe time
      ctx.save();
    }

    await i.deferUpdate();
    try {
      const server = await getServer(id);
      if (!server) return i.editReply({ content: '⚠️ That server could not be found on BattleMetrics.', embeds: [], components: [] });

      const isMain = server.id === r.mainServerId;
      const canSetMain = i.member.permissions.has(PermissionFlagsBits.ManageGuild);
      return i.editReply({
        content: action === 'setmain' ? `⭐ **${server.attributes.name}** is now this server's main tracked Rust server.` : '',
        embeds: [rustEmbed(server, isMain)],
        components: [rustButtons(server.id, isMain, canSetMain)],
      });
    } catch (e) {
      return i.editReply({ content: e.message === 'NO_KEY' ? NO_KEY_MSG : `⚠️ BattleMetrics error: ${e.message}`, embeds: [], components: [] });
    }
  },
};

module.exports.rustState = rustState;
module.exports.registerRustWipeWatcher = registerRustWipeWatcher;
