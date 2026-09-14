/* ══════════════════════════════════════════════════════════════════
   JOIN-TO-CREATE + /vc OWNER PANEL
   Temporary voice channels with per-channel owner permissions.
   ─ /jointocreate  : admin setup (lobby + category, enable/disable)
   ─ /vc            : owner control panel (VC-scoped only)
   No companion text channel is created — commands and messages use the
   voice channel's own built-in text chat.
   Security: ALL permissions are overwrites on the temporary VC only —
   never roles, never server-wide.
   ══════════════════════════════════════════════════════════════════ */
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
  UserSelectMenuBuilder, RoleSelectMenuBuilder, PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { colors, row, err, voiceChannels, categories } = require('./_shared');

const commands = [];

/* ── state helpers (persisted via ctx.guild / ctx.save) ── */
const JC_DEFAULTS = () => ({
  enabled: false, lobbyChannelId: null, categoryId: null, temp: {},
  protectedUserIds: [], protectedRoleIds: [],
});
/* g.jointocreate.temp = { [vcId]: { ownerId } } */
const jcState = (g) => {
  if (!g.jointocreate) g.jointocreate = JC_DEFAULTS();
  if (!g.jointocreate.temp) g.jointocreate.temp = {};
  g.jointocreate.protectedUserIds ??= [];
  g.jointocreate.protectedRoleIds ??= [];
  return g.jointocreate;
};

/* in-memory mirror of temp VCs — rebuilt from persisted state / scan on startup */
const tempVCs = new Map(); /* vcId -> { ownerId } */

const JC_NAME_SUFFIX = "'s VC"; /* used to recognize bot-created VCs after restarts */

/* a member is protected from being blacklisted/removed/muted/deafened/disconnected via /vc
   if they're a real Discord Administrator, or an admin explicitly protected them (or one of
   their roles) via /vcadmin — returns why, or null if they aren't protected */
const jcProtectionReason = (guild, memberId, state) => {
  const member = guild.members.cache.get(memberId);
  if (member?.permissions.has(PermissionFlagsBits.Administrator)) return 'server Administrator';
  if (state.protectedUserIds?.includes(memberId)) return 'individually protected';
  const roleId = state.protectedRoleIds?.find(id => member?.roles.cache.has(id));
  if (roleId) return `protected role: ${guild.roles.cache.get(roleId)?.name ?? roleId}`;
  return null;
};
const jcProtectedMember = (guild, memberId, state) => Boolean(jcProtectionReason(guild, memberId, state));

/* ── security guard: normally the user must be sitting in a tracked temp VC AND own it —
   but a server Administrator may instead pick any temp VC via /vcadmin (tracked in
   i.client.vcPanels) and gets full owner-equivalent control over it ── */
function vcGuard(i) {
  const isAdmin = Boolean(i.member?.permissions.has(PermissionFlagsBits.Administrator));
  const selectedId = isAdmin ? i.client.vcPanels?.get(i.user.id) : null;
  const vc = selectedId
    ? i.guild.channels.cache.get(selectedId)
    : i.guild.channels.cache.get(i.member.voice.channelId);
  if (!vc) return { fail: selectedId ? "That temporary VC no longer exists — pick another one with `/vcadmin`." : 'You must be **connected to your temporary VC** to use this.' };
  const data = tempVCs.get(vc.id);
  if (!data) return { fail: "That isn't a temporary VC — /vc only controls channels created by /jointocreate." };
  if (data.ownerId !== i.user.id && !isAdmin) return { fail: `👑 Only the VC owner (<@${data.ownerId}>) can do that.` };
  return { vc, data, isAdmin };
}


/* ── apply owner overwrites — scoped to ONLY this VC ── */
function ownerOverwrites(vc, ownerId) {
  if (!vc) return;
  vc.permissionOverwrites.edit(ownerId, {
    ViewChannel: true, Connect: true, Speak: true, PrioritySpeaker: true,
    ManageChannels: true, MoveMembers: true, MuteMembers: true, DeafenMembers: true,
    Stream: true, UseVoiceActivity: true, SendMessages: true,
  }).catch(() => {});
}

/* ── full revoke of an owner's temp overwrites (transfer / delete) ── */
function revokeOwner(vc, ownerId) {
  if (!ownerId || !vc) return;
  vc.permissionOverwrites.delete(ownerId).catch(() => {});
}

/* ── create a temp VC (with its own built-in text chat) and move the creator in ── */
async function jcCreateVC(guild, member, state, ctx) {
  const cat = guild.channels.cache.get(state.categoryId) ?? null;
  const vc = await guild.channels.create({
    name: `${member.user.username}${JC_NAME_SUFFIX}`,
    type: ChannelType.GuildVoice,
    parent: cat?.id ?? null,
    userLimit: 0,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageChannels] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages] },
    ],
  }).catch(() => null);
  if (!vc) return null;

  tempVCs.set(vc.id, { ownerId: member.id });
  state.temp[vc.id] = { ownerId: member.id };
  ctx.save();

  ownerOverwrites(vc, member.id);
  await member.voice.setChannel(vc).catch(async () => {
    /* couldn't move them (they left instantly) — tear down to avoid orphans */
    await jcDeleteVC(guild, vc.id, ctx).catch(() => {});
    return null;
  });
  if (!member.voice.channelId || member.voice.channelId !== vc.id) return vc;

  const data = tempVCs.get(vc.id);
  await vc.send({ content: `<@${member.id}> — here's your \`/vc\` control panel:`, embeds: [vcEmbed(null, vc, data)], components: vcPanel(vc, data) }).catch(() => {});
  return vc;
}

/* ── delete a temp VC + revoke all temp perms ── */
async function jcDeleteVC(guild, vcId, ctx) {
  tempVCs.delete(vcId);
  const g = ctx.guild(guild.id);
  if (g?.jointocreate?.temp) { delete g.jointocreate.temp[vcId]; ctx.save(); }
  const vc = guild.channels.cache.get(vcId);
  if (vc) await vc.delete().catch(() => {});
  else await guild.channels.delete(vcId).catch(() => {});
}

/* ── transfer ownership: swap overwrites, announce, refresh welcome ── */
async function jcTransfer(vc, data, newOwnerId, ctx, reason = 'left') {
  const oldOwnerId = data.ownerId;
  revokeOwner(vc, oldOwnerId);
  ownerOverwrites(vc, newOwnerId);
  data.ownerId = newOwnerId;
  const g = ctx.guild(vc.guild.id);
  if (g?.jointocreate?.temp?.[vc.id]) { g.jointocreate.temp[vc.id] = data; ctx.save(); }
  await vc.send({
    content: `👑 <@${oldOwnerId}> ${reason} — ownership transferred to <@${newOwnerId}>. Use \`/vc\` to manage it:\n`
      + '🔊 Rename • 👥 Limit • 🔇 Mute • 🎧 Deafen • 🦵 Disconnect/Remove • ✅/⛔ Whitelist/Blacklist • 📋 Members • 👑 Transfer • ♻️ Reset • 🗑️ Delete',
  }).catch(() => {});
}

/* ═══════════════════════════ /jointocreate command ═══════════════════════════ */

commands.push({
  data: new SlashCommandBuilder()
    .setName('jointocreate')
    .setDescription('🎙️ Join-to-Create voice lobbies — pick lobby & category from dropdowns')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'jtc',

  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const s = jcState(g);
    ctx.save();
    return i.reply({ embeds: [jcSetupEmbed(i, s)], components: jcSetupPanel(s), ephemeral: true });
  },

  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const s = jcState(g);
    const action = i.customId.split(':')[1];

    if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }
    if (action === 'toggle') {
      if (!s.lobbyChannelId) return err(i, 'Pick a **lobby channel** first.');
      s.enabled = !s.enabled;
      ctx.save();
      return i.update({ embeds: [jcSetupEmbed(i, s)], components: jcSetupPanel(s) });
    }
    if (action === 'reset') {
      g.jointocreate = JC_DEFAULTS();
      ctx.save();
      return i.update({ embeds: [jcSetupEmbed(i, jcState(g))], components: jcSetupPanel(jcState(g)) });
    }
  },

  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    const s = jcState(g);
    const action = i.customId.split(':')[1];

    if (action === 'lobbySel') {
      s.lobbyChannelId = i.values[0];
      ctx.save();
      return i.update({ content: `🎙️ Lobby channel set to <#${s.lobbyChannelId}>.`, components: [] });
    }
    if (action === 'catSel') {
      s.categoryId = i.values[0];
      ctx.save();
      const cat = i.guild.channels.cache.get(s.categoryId);
      return i.update({ content: `📁 Temporary VCs will be created in \`${cat?.name ?? 'deleted'}\`.`, components: [] });
    }
  },
});

function jcSetupEmbed(i, s) {
  const lobby = s.lobbyChannelId ? `<#${s.lobbyChannelId}>` : '*not set*';
  const cat = s.categoryId ? (i.guild.channels.cache.get(s.categoryId)?.name ? `\`${i.guild.channels.cache.get(s.categoryId).name}\`` : '`deleted`') : '*not set*';
  return new EmbedBuilder()
    .setTitle('🎙️ Join-to-Create')
    .setDescription(
      'When a member joins the lobby channel, a **temporary VC** is created just for them\n'
      + 'with owner permissions scoped to that VC only — and it auto-deletes when empty.\n\n'
      + `**Status:** ${s.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n`
      + `**Lobby Channel:** ${lobby}\n`
      + `**Category for temp VCs:** ${cat}\n\n`
      + 'Owners manage their VC with **/vc** — rename, limit, mute, deafen, disconnect,\n'
      + 'whitelist/blacklist users, transfer, reset and delete. All permissions are per-channel only.',
    )
    .setColor(s.enabled ? colors.good : colors.main);
}

function jcSetupPanel(s) {
  return [
    row(
      new ButtonBuilder().setCustomId('jtc:toggle').setLabel(s.enabled ? '⬇️ Disable' : '🚀 Enable').setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder().setCustomId('jtc:reset').setLabel('♻️ Reset').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('jtc:close').setLabel('✖️').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* dropdowns are attached to the ephemeral reply on first open — add them to run() via components? no:
   keep them behind an "edit" style: we attach selects directly in run()'s reply for simplicity. */
/* (see jcSetupPanelWithSelects used by run()) */

/* ═══════════════════════════ /vc owner panel ═══════════════════════════ */

commands.push({
  data: new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Manage your temporary VC (created by /jointocreate) — owner only'),
  ns: 'vc',

  async run(i) {
    const guard = vcGuard(i);
    if (guard.fail) return err(i, guard.fail);
    return i.reply({ embeds: [vcEmbed(i, guard.vc, guard.data)], components: vcPanel(guard.vc, guard.data), ephemeral: true });
  },

  async onButton(i, ctx) {
    const guard = vcGuard(i);
    if (guard.fail) return err(i, guard.fail);
    const { vc, data } = guard;
    const action = i.customId.split(':')[1];

    if (action === 'refresh') return i.update({ embeds: [vcEmbed(i, vc, data)], components: vcPanel(vc, data) });

    if (action === 'rename') {
      const modal = new ModalBuilder().setCustomId('vc:renameModal').setTitle('Rename VC').addComponents(
        row(new TextInputBuilder().setCustomId('v').setLabel('Channel name').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(vc.name).setRequired(true)));
      return i.showModal(modal);
    }

    if (action === 'limit') {
      const modal = new ModalBuilder().setCustomId('vc:limitModal').setTitle('User Limit').addComponents(
        row(new TextInputBuilder().setCustomId('v').setLabel('Max users (0 = unlimited, max 99)').setStyle(TextInputStyle.Short).setMaxLength(2).setValue(String(vc.userLimit ?? 0)).setRequired(true)));
      return i.showModal(modal);
    }

    if (action === 'whitelist') {
      const sel = new UserSelectMenuBuilder().setCustomId('vc:whitelistSel').setPlaceholder('✅ Users allowed into this VC…').setMaxValues(10);
      return i.reply({ content: '✅ Pick users who may always join:', components: [row(sel)], ephemeral: true });
    }

    if (action === 'blacklist') {
      const sel = new UserSelectMenuBuilder().setCustomId('vc:blacklistSel').setPlaceholder('⛔ Users banned from this VC…').setMaxValues(10);
      return i.reply({ content: '⛔ Pick users who may **never** join this VC (they get kicked if inside):', components: [row(sel)], ephemeral: true });
    }

    if (action === 'remove') {
      const members = [...vc.members.values()].filter(m => m.id !== data.ownerId);
      if (!members.length) return err(i, 'Nobody else is in your VC right now.');
      const sel = new StringSelectMenuBuilder().setCustomId('vc:removeSel').setPlaceholder('🦵 Select members to remove once…')
        .setMinValues(1).setMaxValues(Math.min(members.length, 25))
        .addOptions(members.map(m => ({ label: m.user.username.slice(0, 100), value: m.id, emoji: '🦵' })));
      return i.reply({ content: '🦵 Pick members to disconnect once (they may rejoin unless also blacklisted):', components: [row(sel)], ephemeral: true });
    }

    if (action === 'transfer') {
      const sel = new UserSelectMenuBuilder().setCustomId('vc:transferSel').setPlaceholder('👑 New owner (must be in the VC)…').setMaxValues(1);
      return i.reply({ content: '👑 Pick the member who becomes the new VC owner:', components: [row(sel)], ephemeral: true });
    }

    if (action === 'members') {
      const list = vc.members.map(m => `• ${m} — ${m.voice.serverMute ? '🔇 muted' : '🔊 unmuted'}, ${m.voice.serverDeaf ? '🎧 deafened' : '🎧 hearing'}`).join('\n') || '*empty*';
      return i.reply({ embeds: [new EmbedBuilder().setTitle(`📋 Members in ${vc.name}`).setDescription(list).setColor(colors.main)], ephemeral: true });
    }

    if (action === 'reset') {
      await vc.setName(`${i.member.user.username}${JC_NAME_SUFFIX}`).catch(() => {});
      await vc.setUserLimit(0).catch(() => {});
      await vc.permissionOverwrites.edit(vc.guild.roles.everyone.id, { ViewChannel: false, Connect: false }).catch(() => {});
      for (const [id] of vc.permissionOverwrites.cache) {
        if (id !== vc.guild.members.me.id && id !== data.ownerId) await vc.permissionOverwrites.delete(id).catch(() => {});
      }
      ownerOverwrites(vc, data.ownerId);
      return i.reply({ content: '♻️ VC reset — name, limit and whitelist/blacklist cleared.', ephemeral: true });
    }

    if (action === 'delete') {
      await i.reply({ content: '🗑️ Your VC is being deleted…', ephemeral: true });
      return jcDeleteVC(vc.guild, vc.id, ctx);
    }

    if (action === 'close') return i.message.delete().catch(() => {});

    /* member-action buttons open a select of everyone currently in the VC */
    if (['mute', 'deafen', 'disconnect'].includes(action)) {
      const members = [...vc.members.values()];
      if (!members.length) return err(i, 'Nobody is in your VC right now.');
      const emoji = { mute: '🔇', deafen: '🎧', disconnect: '🦵' }[action];
      const sel = new StringSelectMenuBuilder().setCustomId(`vc:${action}Sel`).setPlaceholder(`${emoji} Pick members to ${action}…`)
        .setMinValues(1).setMaxValues(Math.min(members.length, 25))
        .addOptions(members.map(m => ({ label: m.user.username.slice(0, 100), value: m.id, emoji })));
      return i.reply({ content: `${emoji} Pick members to **${action}** (in your VC only):`, components: [row(sel)], ephemeral: true });
    }
  },

  async onSelect(i, ctx) {
    const guard = vcGuard(i);
    if (guard.fail) return err(i, guard.fail);
    const { vc, data } = guard;
    const action = i.customId.split(':')[1];
    const state = jcState(ctx.guild(i.guildId));

    if (action === 'muteSel') {
      const results = [];
      for (const id of i.values) {
        const reason = jcProtectionReason(i.guild, id, state);
        if (reason) { results.push(`<@${id}> → 🛡️ protected (${reason}), skipped`); continue; }
        const m = vc.members.get(id);
        if (!m) continue;
        await m.voice.setMute(!m.voice.serverMute).then(() => results.push(`${m} → ${!m.voice.serverMute ? '🔇 muted' : '🔊 unmuted'}`)).catch(() => results.push(`${m} → ⚠️ failed`));
      }
      return i.update({ content: results.join('\n') || '⚠️ No targets were in your VC.', components: [] });
    }

    if (action === 'deafenSel') {
      const results = [];
      for (const id of i.values) {
        const reason = jcProtectionReason(i.guild, id, state);
        if (reason) { results.push(`<@${id}> → 🛡️ protected (${reason}), skipped`); continue; }
        const m = vc.members.get(id);
        if (!m) continue;
        await m.voice.setDeaf(!m.voice.serverDeaf).then(() => results.push(`${m} → ${!m.voice.serverDeaf ? '🎧 deafened' : '🎧 undeafened'}`)).catch(() => results.push(`${m} → ⚠️ failed`));
      }
      return i.update({ content: results.join('\n') || '⚠️ No targets were in your VC.', components: [] });
    }

    if (action === 'disconnectSel') {
      const results = [];
      for (const id of i.values) {
        const reason = jcProtectionReason(i.guild, id, state);
        if (reason) { results.push(`<@${id}> → 🛡️ protected (${reason}), skipped`); continue; }
        const m = vc.members.get(id);
        if (!m) continue;
        await m.voice.disconnect().then(() => results.push(`🦵 ${m} disconnected`)).catch(() => results.push(`${m} → ⚠️ failed`));
      }
      return i.update({ content: results.join('\n') || '⚠️ No targets were in your VC.', components: [] });
    }

    if (action === 'removeSel') {
      const results = [];
      for (const id of i.values) {
        if (id === data.ownerId) continue;
        const reason = jcProtectionReason(i.guild, id, state);
        if (reason) { results.push(`<@${id}> → 🛡️ protected (${reason}), skipped`); continue; }
        const m = vc.members.get(id);
        if (!m) continue;
        await m.voice.disconnect().then(() => results.push(`🦵 ${m} removed`)).catch(() => results.push(`${m} → ⚠️ failed`));
      }
      return i.update({ content: results.join('\n') || '⚠️ No targets were in your VC.', components: [] });
    }


    if (action === 'whitelistSel') {
      for (const id of i.values) {
        await vc.permissionOverwrites.edit(id, { ViewChannel: true, Connect: true, Speak: true }).catch(() => {});
      }
      return i.update({ content: `✅ Whitelisted: ${i.values.map(id => `<@${id}>`).join(', ')}`, components: [] });
    }

    if (action === 'blacklistSel') {
      const blocked = [];
      const skipped = [];
      for (const id of i.values) {
        if (id === data.ownerId) continue;
        const reason = jcProtectionReason(i.guild, id, state);
        if (reason) { skipped.push(`<@${id}> (${reason})`); continue; }
        await vc.permissionOverwrites.edit(id, { ViewChannel: false, Connect: false }).catch(() => {});
        vc.members.get(id)?.voice.disconnect().catch(() => {});
        blocked.push(id);
      }
      return i.update({
        content: `⛔ Blacklisted & removed: ${blocked.map(id => `<@${id}>`).join(', ') || 'nobody'}`
          + (skipped.length ? `\n🛡️ Skipped (protected): ${skipped.join(', ')}` : ''),
        components: [],
      });
    }

    if (action === 'transferSel') {
      const newId = i.values[0];
      const m = vc.members.get(newId);
      if (!m) return i.update({ content: '⚠️ They must be **in the VC** to receive ownership.', components: [] });
      await jcTransfer(vc, data, newId, ctx, 'transferred ownership');
      return i.update({ content: `👑 <@${newId}> is now the VC owner. Your permissions were revoked.`, components: [] });
    }
  },

  async onModal(i, ctx) {
    const guard = vcGuard(i);
    if (guard.fail) return err(i, guard.fail);
    const { vc, data } = guard;
    const action = i.customId.split(':')[1];

    if (action === 'renameModal') {
      const name = i.fields.getTextInputValue('v');
      await vc.setName(name).then(() => i.reply({ content: `✏️ Renamed to **${name}**.`, ephemeral: true })).catch(() => err(i, "Couldn't rename (missing permission or rate-limit)."));
      return;
    }
    if (action === 'limitModal') {
      const n = Math.max(0, Math.min(99, parseInt(i.fields.getTextInputValue('v'), 10) || 0));
      await vc.setUserLimit(n).then(() => i.reply({ content: `👥 User limit set to **${n === 0 ? 'unlimited' : n}**.`, ephemeral: true })).catch(() => err(i, "Couldn't set the limit."));
      return;
    }
  },
});

/* ── /vc dashboard visuals ── */
function vcEmbed(i, vc, data) {
  const allows = vc.permissionOverwrites.cache.filter(o => o.type === 1 && o.id !== data.ownerId && o.allow.has(PermissionFlagsBits.Connect)).map(o => `<@${o.id}>`);
  const denies = vc.permissionOverwrites.cache.filter(o => o.type === 1 && o.id !== data.ownerId && o.deny.has(PermissionFlagsBits.Connect)).map(o => `<@${o.id}>`);
  return new EmbedBuilder()
    .setTitle(`Your VC — ${vc.name}`)
    .setDescription(
      `👑 **Owner:** <@${data.ownerId}>\n`
      + `**Limit:** ${vc.userLimit || 'unlimited'}\n**Members here:** ${vc.members.size}\n\n`
      + `**Whitelisted users:** ${allows.length ? allows.join(', ') : '*none*'}\n`
      + `**Blacklisted users:** ${denies.length ? denies.join(', ') : '*none*'}\n\n`
      + '*All actions affect **only this VC** — you cannot touch other channels, roles or members.*',
    )
    .setColor(colors.main)
    .setFooter({ text: 'This panel only controls your own temporary VC' });
}

function vcPanel(vc, data) {
  return [
    row(
      new ButtonBuilder().setCustomId('vc:rename').setLabel('🔊 Rename').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('vc:limit').setLabel('👥 Limit').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('vc:reset').setLabel('♻️ Reset').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('vc:mute').setLabel('🔇 Mute').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc:deafen').setLabel('🎧 Deafen').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc:disconnect').setLabel('🦵 Disconnect').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('vc:whitelist').setLabel('✅ Whitelist').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('vc:blacklist').setLabel('⛔ Blacklist').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('vc:remove').setLabel('🦵 Remove').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc:members').setLabel('📋 Members').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc:transfer').setLabel('👑 Transfer').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('vc:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc:delete').setLabel('🗑️ Delete VC').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('vc:close').setLabel('✖️').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* ═══════════════════════════ /vcadmin — admin oversight of any temp VC ═══════════════════════════ */

function vcAdminEmbed(guild) {
  const active = [];
  for (const [id, data] of tempVCs) {
    const vc = guild.channels.cache.get(id);
    if (!vc || !vc.members.size) continue;
    const members = vc.members.map(member => `• ${member.user.username}`).join('\n');
    active.push(`**${vc.name}** — Owner: <@${data.ownerId}>\n${members}`);
  }
  return new EmbedBuilder().setTitle('🛡️ VC Admin Dashboard')
    .setDescription(active.join('\n\n').slice(0, 3900) || '*No active temporary VCs.*')
    .setColor(colors.main);
}

commands.push({
  data: new SlashCommandBuilder().setName('vcadmin')
    .setDescription('🛡️ Select and manage any temporary VC, and protect people/roles from /vc actions')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ns: 'vcadmin',

  async run(i) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return err(i, 'Administrator permission required.');
    const choices = [...tempVCs.entries()].map(([id, data]) => {
      const vc = i.guild.channels.cache.get(id);
      return vc ? { label: vc.name.slice(0, 100), value: id, emoji: '🔊', description: `Owner: ${data.ownerId}`.slice(0, 100) } : null;
    }).filter(Boolean).slice(0, 25);
    const selector = new StringSelectMenuBuilder().setCustomId('vcadmin:pick').setPlaceholder('🔊 Select a temporary VC to manage…')
      .addOptions(choices.length ? choices : [{ label: 'No temporary VCs available', value: 'none', emoji: '⚠️' }]);
    return i.reply({
      embeds: [vcAdminEmbed(i.guild)],
      components: [row(selector), row(
        new ButtonBuilder().setCustomId('vcadmin:active').setLabel('🔄 Refresh Active').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('vcadmin:protectedUsers').setLabel('🛡️ Protected Users').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcadmin:protectedRoles').setLabel('🛡️ Protected Roles').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('vcadmin:resetAll').setLabel('♻️ Reset All').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('vcadmin:close').setLabel('✖️ Close').setStyle(ButtonStyle.Secondary),
      )],
      ephemeral: true,
    });
  },

  async onSelect(i, ctx) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return err(i, 'Administrator permission required.');
    const state = jcState(ctx.guild(i.guildId));

    if (i.customId === 'vcadmin:userAddSel') {
      for (const id of i.values) if (!state.protectedUserIds.includes(id)) state.protectedUserIds.push(id);
      ctx.save();
      return i.update({ content: `✅ Protected: ${i.values.map(id => `<@${id}>`).join(', ')}`, components: [] });
    }
    if (i.customId === 'vcadmin:userRemoveSel') {
      state.protectedUserIds = state.protectedUserIds.filter(id => !i.values.includes(id));
      ctx.save();
      return i.update({ content: `⛔ No longer protected: ${i.values.map(id => `<@${id}>`).join(', ')} — they can now be blacklisted and auto-kicked from temp VCs.`, components: [] });
    }
    if (i.customId === 'vcadmin:roleAddSel') {
      for (const id of i.values) if (!state.protectedRoleIds.includes(id)) state.protectedRoleIds.push(id);
      ctx.save();
      return i.update({ content: `✅ Protected: ${i.values.map(id => `<@&${id}>`).join(', ')}`, components: [] });
    }
    if (i.customId === 'vcadmin:roleRemoveSel') {
      state.protectedRoleIds = state.protectedRoleIds.filter(id => !i.values.includes(id));
      ctx.save();
      return i.update({ content: `⛔ No longer protected: ${i.values.map(id => `<@&${id}>`).join(', ')} — members with only that role can now be blacklisted and auto-kicked from temp VCs.`, components: [] });
    }

    if (i.customId === 'vcadmin:pick') {
      const vc = i.guild.channels.cache.get(i.values[0]);
      const data = vc && tempVCs.get(vc.id);
      if (!vc || !data) return err(i, 'That temporary VC no longer exists.');
      i.client.vcPanels ??= new Map();
      i.client.vcPanels.set(i.user.id, vc.id);
      return i.update({ embeds: [vcEmbed(i, vc, data)], components: vcPanel(vc, data) });
    }
  },

  async onButton(i, ctx) {
    if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return err(i, 'Administrator permission required.');
    if (i.customId === 'vcadmin:close') return i.update({ content: '🛡️ Admin dashboard closed.', embeds: [], components: [] });
    if (i.customId === 'vcadmin:active') return i.update({ embeds: [vcAdminEmbed(i.guild)] });

    if (i.customId === 'vcadmin:resetAll') {
      const state = jcState(ctx.guild(i.guildId));
      state.protectedUserIds = [];
      state.protectedRoleIds = [];
      let vcCount = 0;
      for (const [id, data] of tempVCs) {
        const vc = i.guild.channels.cache.get(id);
        if (!vc) continue;
        for (const [memberId] of vc.permissionOverwrites.cache) {
          if (memberId !== vc.guild.members.me.id && memberId !== data.ownerId) {
            await vc.permissionOverwrites.delete(memberId).catch(() => {});
          }
        }
        vcCount++;
      }
      ctx.save();
      return i.update({ content: `♻️ Reset complete — cleared protected users/roles and whitelist/blacklist entries across ${vcCount} active temp VC(s).`, embeds: [], components: [] });
    }

    if (i.customId === 'vcadmin:protectedUsers') {
      return i.update({
        content: '🛡️ **Protected Users** — choose what to do:',
        components: [row(
          new ButtonBuilder().setCustomId('vcadmin:userMode:protect').setLabel('✅ Protect').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('vcadmin:userMode:unprotect').setLabel('⛔ Unprotect').setStyle(ButtonStyle.Danger),
        )],
      });
    }
    if (i.customId === 'vcadmin:protectedRoles') {
      return i.update({
        content: '🛡️ **Protected Roles** — choose what to do:',
        components: [row(
          new ButtonBuilder().setCustomId('vcadmin:roleMode:protect').setLabel('✅ Protect').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('vcadmin:roleMode:unprotect').setLabel('⛔ Unprotect').setStyle(ButtonStyle.Danger),
        )],
      });
    }

    if (i.customId === 'vcadmin:userMode:protect') {
      const selector = new UserSelectMenuBuilder().setCustomId('vcadmin:userAddSel')
        .setPlaceholder('✅ Select users to protect…').setMinValues(1).setMaxValues(25);
      return i.update({ content: '✅ Pick users to add to the protected list:', components: [row(selector)] });
    }
    if (i.customId === 'vcadmin:userMode:unprotect') {
      const state = jcState(ctx.guild(i.guildId));
      if (!state.protectedUserIds.length) return i.update({ content: '⛔ No users are currently protected.', components: [] });
      const options = state.protectedUserIds.map(id => ({
        label: (i.guild.members.cache.get(id)?.user.username ?? id).slice(0, 100), value: id, emoji: '🛡️',
      }));
      const selector = new StringSelectMenuBuilder().setCustomId('vcadmin:userRemoveSel')
        .setPlaceholder('⛔ Select users to unprotect…').setMinValues(1).setMaxValues(options.length).addOptions(options);
      return i.update({ content: '⛔ Pick users to remove from the protected list:', components: [row(selector)] });
    }
    if (i.customId === 'vcadmin:roleMode:protect') {
      const selector = new RoleSelectMenuBuilder().setCustomId('vcadmin:roleAddSel')
        .setPlaceholder('✅ Select roles to protect…').setMinValues(1).setMaxValues(25);
      return i.update({ content: '✅ Pick roles to add to the protected list:', components: [row(selector)] });
    }
    if (i.customId === 'vcadmin:roleMode:unprotect') {
      const state = jcState(ctx.guild(i.guildId));
      if (!state.protectedRoleIds.length) return i.update({ content: '⛔ No roles are currently protected.', components: [] });
      const options = state.protectedRoleIds.map(id => ({
        label: (i.guild.roles.cache.get(id)?.name ?? id).slice(0, 100), value: id, emoji: '🛡️',
      }));
      const selector = new StringSelectMenuBuilder().setCustomId('vcadmin:roleRemoveSel')
        .setPlaceholder('⛔ Select roles to unprotect…').setMinValues(1).setMaxValues(options.length).addOptions(options);
      return i.update({ content: '⛔ Pick roles to remove from the protected list:', components: [row(selector)] });
    }
  },
});

/* ═══════════════════════════ join-to-create ENGINE ═══════════════════════════ */

function registerJoinToCreate(client, ctx) {
  /* ── join / leave / transfer logic ── */
  client.on('voiceStateUpdate', async (oldS, newS) => {
    try {
      const guild = newS.guild ?? oldS.guild;
      if (!guild) return;
      const g = ctx.guild(guild.id);
      const s = g ? jcState(g) : null;
      if (!s) return;

      /* mirror persisted temp state into memory */
      for (const [id, d] of Object.entries(s.temp)) if (!tempVCs.has(id)) tempVCs.set(id, d);

      /* ── JOIN: creator hit the lobby channel ── */
      if (s.enabled && newS.channelId && newS.channelId === s.lobbyChannelId && oldS.channelId !== newS.channelId && !newS.member.user.bot) {
        const existing = [...tempVCs.entries()].find(([, d]) => d.ownerId === newS.id);
        if (existing) return newS.setChannel(existing[0]).catch(() => {});
        await jcCreateVC(guild, newS.member, s, ctx);
        return;
      }

      /* ── LEAVE / MOVE-OUT of a temp VC ── */
      if (oldS.channelId && tempVCs.has(oldS.channelId) && oldS.channelId !== newS.channelId) {
        const vc = guild.channels.cache.get(oldS.channelId);
        if (!vc) { tempVCs.delete(oldS.channelId); return; }
        const data = tempVCs.get(oldS.channelId);

        if (vc.members.size === 0) {
          return jcDeleteVC(guild, oldS.channelId, ctx); /* auto-delete when empty */
        }
        /* owner left but people remain → transfer to the next member present */
        if (data.ownerId === oldS.id) {
          const next = vc.members.find(m => !m.user.bot) ?? vc.members.first();
          await jcTransfer(vc, data, next.id, ctx, 'left the VC');
        }
      }

      /* ── someone joined an empty temp VC (keep-alive, nothing to do) ── */
    } catch { /* never crash the bot over join-to-create */ }
  });

  /* ── manual deletion of a temp VC → clean up state ── */
  client.on('channelDelete', async (ch) => {
    try {
      if (!ch.guild) return;
      tempVCs.delete(ch.id);
      const g = ctx.guild(ch.guild.id);
      if (g?.jointocreate?.temp?.[ch.id]) { delete g.jointocreate.temp[ch.id]; ctx.save(); }
    } catch { /* never crash */ }
  });

  /* ── restart reconcile: re-adopt surviving temp VCs, delete empty orphans ── */
  client.on('guildCreate', (g) => reconcile(g, ctx));
  client.once('clientReady', async () => {
    try {
      for (const g of client.guilds.cache.values()) await reconcile(g, ctx);
    } catch { /* never crash */ }
  });

  async function reconcile(guild, ctx) {
    try {
      const g = ctx.guild(guild.id);
      const s = g ? jcState(g) : null;
      if (!s) return;
      for (const [id, d] of Object.entries(s.temp)) if (!tempVCs.has(id)) tempVCs.set(id, d);

      const vcIds = new Set(Object.keys(s.temp));
      for (const [id, d] of tempVCs) vcIds.add(id);

      for (const id of vcIds) {
        const vc = guild.channels.cache.get(id);
        if (!vc) { /* deleted while bot was offline */
          tempVCs.delete(id);
          delete s.temp[id];
          ctx.save();
          continue;
        }
        if (vc.members.size === 0) { await jcDeleteVC(guild, id, ctx); continue; }

        /* re-adopt: rebuild owner overwrites (owner may be stale after restart) */
        if (!vc.members.has(d.ownerId)) d.ownerId = (vc.members.find(m => !m.user.bot) ?? vc.members.first()).id;
        ownerOverwrites(vc, d.ownerId);
        s.temp[id] = d;
        ctx.save();
      }

      /* orphan scan: bot-created VCs in the category that nobody tracks */
      if (s.categoryId) {
        for (const ch of guild.channels.cache.filter(c => c.parentId === s.categoryId && c.type === ChannelType.GuildVoice && c.name.endsWith(JC_NAME_SUFFIX)).values()) {
          if (vcIds.has(ch.id)) continue;
          if (ch.members.size === 0) await ch.delete().catch(() => {});
          else {
            const owner = (ch.members.find(m => !m.user.bot) ?? ch.members.first()).id;
            const rec = { ownerId: owner };
            tempVCs.set(ch.id, rec); s.temp[ch.id] = rec; ctx.save();
            ownerOverwrites(ch, owner);
          }
        }
      }
    } catch { /* never crash */ }
  }
}

/* ══════════════════ /jointocreate run() with select menus (replaces the simple reply) ══════════════════ */
/* NOTE: swap the run() body of the jtc command above if you want the dropdowns in-panel.
   Simpler approach used here: dropdowns attached to the first reply. Replace the jtc run() with: */
commands[commands.findIndex(c => c.ns === 'jtc')].run = async function (i, ctx) {
  const g = ctx.guild(i.guildId);
  const s = jcState(g);
  ctx.save();
  const lobbies = voiceChannels(i, 25);
  const cats = categories(i, 25);
  const lobbySel = new StringSelectMenuBuilder().setCustomId('jtc:lobbySel').setPlaceholder('🎙️ Pick the lobby channel…')
    .addOptions(lobbies.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '🎙️', default: c.id === s.lobbyChannelId })));
  const catSel = new StringSelectMenuBuilder().setCustomId('jtc:catSel').setPlaceholder('📁 Pick the category for temp VCs…')
    .addOptions(cats.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁', default: c.id === s.categoryId })));
  return i.reply({
    embeds: [jcSetupEmbed(i, s)],
    components: [...(lobbies.length && cats.length ? [row(lobbySel), row(catSel)] : []), ...jcSetupPanel(s)],
    ephemeral: true,
  });
};

module.exports = { commands, registerJoinToCreate, jcState };