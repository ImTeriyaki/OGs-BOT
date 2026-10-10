const fs = require('fs');
const path = require('path');

/* ═══════════════ CLEANUP ═══════════════
   Periodic housekeeping so storage doesn't grow forever:
   - old data.json.bak.* backups
   - snipe/edit-snipe/message-history cache entries for channels that no longer exist
   - afk entries for members who left
   - leftover db records for guilds the bot is no longer in
   Nothing here deletes moderation history (warns) — that's data, not junk. */

const ROOT = path.join(__dirname, '..');
const BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

async function runCleanup(client, db, save, snipes, editSnipes, messageHistory) {
  const backups = cleanOldBackups();
  const stale = cleanStaleChannelMaps(client, snipes, editSnipes, messageHistory);
  const dbChanged = await cleanDb(client, db, save);
  console.log(`🧹 Cleanup: removed ${backups} old backup(s), ${stale} stale cache entr${stale === 1 ? 'y' : 'ies'}, db ${dbChanged ? 'pruned' : 'unchanged'}.`);
}

module.exports = { runCleanup };
