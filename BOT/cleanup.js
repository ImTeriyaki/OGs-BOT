const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { ADMIN_LOG_PATH } = require('./commands/_shared');

/* ═══════════════ CLEANUP ═══════════════
   Runs once a week (gated by cleanup-state.json so it survives restarts — checking
   on every ready/interval tick is cheap and a no-op until the week is actually up):
   - old data.json.bak.* backups
   - snipe/edit-snipe/message-history cache entries for channels that no longer exist
   - afk entries for members who left
   - leftover db records for guilds the bot is no longer in
   - for each guild with an archive channel set: posts a downloadable report of that
     week's admin actions + edited/deleted messages, then clears what it archived
   Nothing here deletes moderation history (warns) — that's data, not junk. */

const ROOT = path.join(__dirname, '..');
const BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLEANUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const STATE_PATH = path.join(ROOT, 'cleanup-state.json');

function dueForCleanup() {
  try {
    const { lastRunAt } = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return Date.now() - lastRunAt >= CLEANUP_INTERVAL_MS;
  } catch {
    return true; // no state file yet — first run
  }
}
function markCleanupRun() {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastRunAt: Date.now() }));
}

function cleanOldBackups() {
  let removed = 0;
  for (const file of fs.readdirSync(ROOT)) {
    if (!file.startsWith('data.json.bak.')) continue;
    const full = path.join(ROOT, file);
    if (Date.now() - fs.statSync(full).mtimeMs > BACKUP_MAX_AGE_MS) {
      fs.unlinkSync(full);
      removed++;
    }
  }
  return removed;
}

function cleanStaleChannelMaps(client, ...maps) {
  let removed = 0;
  for (const map of maps) {
    for (const channelId of map.keys()) {
      if (!client.channels.cache.has(channelId)) { map.delete(channelId); removed++; }
    }
  }
  return removed;
}

async function cleanDb(client, db, save) {
  let changed = false;
  for (const guildId of Object.keys(db)) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) { delete db[guildId]; changed = true; continue; }

    const afk = db[guildId].afk;
    if (afk && Object.keys(afk).length) {
      await guild.members.fetch().catch(() => {});
      for (const userId of Object.keys(afk)) {
        if (!guild.members.cache.has(userId)) { delete afk[userId]; changed = true; }
      }
    }
  }
  if (changed) save();
  return changed;
}

/* removes this guild's lines from the shared, multi-guild admin-log.txt —
   only called after that guild's archive has actually been sent, so nothing
   is lost without a downloadable copy existing first */
function pruneAdminLog(guildId) {
  if (!fs.existsSync(ADMIN_LOG_PATH)) return;
  const lines = fs.readFileSync(ADMIN_LOG_PATH, 'utf8').split('\n');
  const kept = lines.filter(l => !l.includes(`guild:${guildId} `));
  fs.writeFileSync(ADMIN_LOG_PATH, kept.join('\n'));
}

const section = (title, lines) => `── ${title} ${'─'.repeat(Math.max(3, 48 - title.length))}\n${lines.length ? lines.join('\n\n') : '(none this week)'}`;

/* builds one guild's weekly archive — admin actions (from admin-log.txt) and the
   edited/deleted messages the bot has seen (from the in-memory messageHistory
   cache) — and posts it as a downloadable .txt to g.archiveChannelId. */
async function sendGuildArchive(client, guild, g, messageHistory) {
  if (!g.archiveChannelId) return false;
  const channel = await guild.channels.fetch(g.archiveChannelId).catch(() => null);
  if (!channel?.isTextBased()) return false;

  const actionLines = fs.existsSync(ADMIN_LOG_PATH)
    ? fs.readFileSync(ADMIN_LOG_PATH, 'utf8').split('\n')
      .filter(l => l.includes(`guild:${guild.id} `))
      .map(l => l.replace(`guild:${guild.id} (${guild.name}) | `, ''))
    : [];

  const edits = [];
  const deletes = [];
  for (const [channelId, events] of messageHistory) {
    const ch = client.channels.cache.get(channelId);
    if (!ch || ch.guildId !== guild.id) continue;
    for (const e of events) {
      const when = new Date(e.at).toISOString();
      if (e.type === 'edited') {
        edits.push(`[${when}] #${ch.name} — ${e.author}\n  before: ${e.before.replace(/\n/g, ' ')}\n  after:  ${e.after.replace(/\n/g, ' ')}`);
      } else {
        deletes.push(`[${when}] #${ch.name} — ${e.author}${e.deletedBy ? ` (deleted by ${e.deletedBy})` : ''}\n  content: ${e.content.replace(/\n/g, ' ')}`);
      }
    }
  }

  const report = [
    `WEEKLY ARCHIVE — ${guild.name}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    section('ADMIN ACTIONS', actionLines),
    '',
    section('EDITED MESSAGES', edits),
    '',
    section('DELETED MESSAGES', deletes),
  ].join('\n');

  const file = new AttachmentBuilder(Buffer.from(report, 'utf8'), { name: `archive-${guild.id}-${new Date().toISOString().slice(0, 10)}.txt` });
  const sent = await channel.send({
    content: `🗂️ **Weekly archive** — ${actionLines.length} admin action(s), ${edits.length} edit(s), ${deletes.length} deletion(s).`,
    files: [file],
  }).catch(() => null);
  if (!sent) return false;

  pruneAdminLog(guild.id);
  for (const channelId of messageHistory.keys()) {
    if (client.channels.cache.get(channelId)?.guildId === guild.id) messageHistory.delete(channelId);
  }
  return true;
}

async function runCleanup(client, db, save, snipes, editSnipes, messageHistory) {
  if (!dueForCleanup()) return;

  const backups = cleanOldBackups();
  const stale = cleanStaleChannelMaps(client, snipes, editSnipes, messageHistory);
  const dbChanged = await cleanDb(client, db, save);

  let archived = 0;
  for (const [guildId, data] of Object.entries(db)) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    if (await sendGuildArchive(client, guild, data, messageHistory)) archived++;
  }

  markCleanupRun();
  console.log(`🧹 Weekly cleanup: removed ${backups} old backup(s), ${stale} stale cache entr${stale === 1 ? 'y' : 'ies'}, db ${dbChanged ? 'pruned' : 'unchanged'}, archived ${archived} guild(s).`);
}

module.exports = { runCleanup };
