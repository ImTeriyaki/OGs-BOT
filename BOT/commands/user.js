const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, menu, rolesMenu } = require('./_shared');

/* server owner and holders of the guild's admin role are off-limits to /user's
   moderation actions — kick/ban/timeout already get this for free from Discord's
   own hierarchy checks (kickable/bannable/moderatable), but warn/roleRemove/nickname
   don't, so this covers everything consistently */
function protectedTargetReason(g, member) {
  if (g.ownerId && member.id === g.ownerId) return 'the server owner';
  if (g.adminRoleId && member.roles.cache.has(g.adminRoleId)) return 'a member with the admin role';
  return null;
}

/* /user panel — member info + every per-member moderation action in one place */
function userEmbed(member, g) {
  const warns = g.warns?.[member.id] ?? [];
  const timedOut = member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now();
  return new EmbedBuilder()
    .setTitle(`👤 ${member.user.username}`)
    .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
    .setColor(member.displayColor || colors.main)
    .addFields(
      { name: '🆔 ID', value: member.id, inline: true },
      { name: '🤖 Bot', value: member.user.bot ? 'Yes' : 'No', inline: true },
      { name: '📅 Account created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '📥 Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: '⚠️ Warnings', value: `${warns.length}`, inline: true },
      { name: '🔇 Timed out', value: timedOut ? `until <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>` : 'No', inline: true },
      { name: '🎭 Roles', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(' ').slice(0, 1024) || '*none*' },
    )
    .setFooter({ text: 'Moderation panel — use the buttons below' });
}

function userRows(member) {
  const timedOut = member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now();
  return [
    row(
      new ButtonBuilder().setCustomId('usr:kick').setLabel('Kick').setEmoji('👢').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('usr:ban').setLabel('Ban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('usr:timeout').setLabel(timedOut ? 'Remove Timeout' : 'Timeout').setEmoji(timedOut ? '🔊' : '🔇').setStyle(timedOut ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('usr:warn').setLabel('Warn').setEmoji('⚠️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('usr:warnings').setLabel('Warnings').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('usr:clearwarnings').setLabel('Clear Warnings').setEmoji('🧽').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:roleAdd').setLabel('Add Role').setEmoji('➕').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:roleRemove').setLabel('Remove Role').setEmoji('➖').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:nickname').setLabel('Nickname').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:dm').setLabel('DM').setEmoji('📨').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId('usr:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('usr:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('👤 View a member and moderate them from one panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('member').setDescription('Member to inspect').setRequired(true)),
  ns: 'usr',
  async run(i, ctx) {
    const member = i.options.getMember('member');
    if (!member) return err(i, 'That user is not in this server.');
    i.client.userPanels ??= new Map();
    i.client.userPanels.set(i.user.id, member.id);
    const g = ctx.guild(i.guildId);
    return i.reply({ embeds: [userEmbed(member, g)], components: userRows(member), ephemeral: true });
  },
  async onButton(i, ctx) {
    const memberId = i.client.userPanels?.get(i.user.id);
    const member = memberId && await i.guild.members.fetch(memberId).catch(() => null);
    if (!member) return err(i, 'Session expired — run `/user` again.');
    const g = ctx.guild(i.guildId);
    const action = i.customId.split(':')[1];

    if (action === 'refresh') return i.update({ embeds: [userEmbed(member, g)], components: userRows(member) });
    if (action === 'close') return i.update({ content: '✖️ Closed.', embeds: [], components: [] });

    if (action === 'kick') {
      if (!i.member.permissions.has(PermissionFlagsBits.KickMembers)) return err(i, 'You need the **Kick Members** permission.');
      const protectedReason = protectedTargetReason(g, member);
      if (protectedReason) return err(i, `🛡️ You can't moderate ${protectedReason}.`);
      if (!member.kickable) return err(i, "I can't kick that member — they outrank me.");
      return i.reply({
        content: `👢 Kicking **${member.user.username}** — pick a reason:`,
        components: [row(menu('usr:kickReason', '👢 Pick a reason…', [
          { label: 'No reason given', value: 'No reason given', emoji: '👢' },
          { label: 'Breaking server rules', value: 'Breaking server rules', emoji: '📜' },
          { label: 'Spamming', value: 'Spamming', emoji: '📢' },
          { label: 'Toxic behavior', value: 'Toxic behavior', emoji: '☠️' },
          { label: 'Inappropriate content', value: 'Inappropriate content', emoji: '🚫' },
          { label: 'Suspected alt/raid account', value: 'Suspected alt/raid account', emoji: '🎭' },
          { label: 'Requested by user', value: 'Requested by user', emoji: '🙏' },
        ]))],
        ephemeral: true,
      });
    }

    if (action === 'ban') {
      if (!i.member.permissions.has(PermissionFlagsBits.BanMembers)) return err(i, 'You need the **Ban Members** permission.');
      const protectedReason = protectedTargetReason(g, member);
      if (protectedReason) return err(i, `🛡️ You can't moderate ${protectedReason}.`);
      if (!member.bannable) return err(i, "I can't ban that member — they outrank me.");
      i.client.userBan ??= new Map();
      i.client.userBan.set(i.user.id, { reason: 'No reason given', days: 0 });
      return i.reply({
        content: `🔨 Banning **${member.user.username}** — configure, then confirm:`,
        components: [
          row(menu('usr:banReason', '🔨 Pick a reason…', [
            { label: 'No reason given', value: 'No reason given', emoji: '🔨' },
            { label: 'Breaking server rules', value: 'Breaking server rules', emoji: '📜' },
            { label: 'Spamming / advertising', value: 'Spamming / advertising', emoji: '📢' },
            { label: 'Raiding the server', value: 'Raiding the server', emoji: '⚔️' },
            { label: 'Scam / phishing links', value: 'Scam / phishing links', emoji: '🎣' },
            { label: 'Toxic behavior', value: 'Toxic behavior', emoji: '☠️' },
            { label: 'Suspected alt/raid account', value: 'Suspected alt/raid account', emoji: '🎭' },
          ])),
          row(menu('usr:banDays', '🧹 Delete their messages from…', [
            { label: "Don't delete messages", value: '0', emoji: '🚫' },
            { label: 'Last 24 hours', value: '1', emoji: '📅' },
            { label: 'Last 3 days', value: '3', emoji: '📅' },
            { label: 'Last 7 days', value: '7', emoji: '📅' },
          ])),
          row(
            new ButtonBuilder().setCustomId('usr:banConfirm').setLabel('✅ Confirm Ban').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('usr:banCancel').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
          ),
        ],
        ephemeral: true,
      });
    }
    if (action === 'banCancel') { i.client.userBan?.delete(i.user.id); return i.update({ content: '✖️ Ban cancelled.', components: [] }); }
    if (action === 'banConfirm') {
      const s = i.client.userBan?.get(i.user.id);
      if (!s) return err(i, 'Session expired — click Ban again.');
      await i.guild.members.ban(member.id, { reason: `[by ${i.user.tag}] ${s.reason}`, deleteMessageSeconds: s.days * 86400 }).catch(() => {});
      i.client.userBan.delete(i.user.id);
      return i.update({ content: `🔨 Banned ${member.user} — *${s.reason}*${s.days ? ` (messages from last ${s.days}d deleted)` : ''}`, components: [] });
    }

    if (action === 'timeout') {
      if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
      const protectedReason = protectedTargetReason(g, member);
      if (protectedReason) return err(i, `🛡️ You can't moderate ${protectedReason}.`);
      const timedOut = member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now();
      if (timedOut) {
        await member.timeout(null);
        return i.update({ embeds: [userEmbed(member, g)], components: userRows(member) });
      }
      if (!member.moderatable) return err(i, "I can't timeout that member.");
      return i.reply({
        content: `🔇 Timing out **${member.user.username}** — pick a duration:`,
        components: [row(menu('usr:timeoutDur', '🔇 Pick a duration…', [
          { label: '60 seconds', value: '60', emoji: '⏱️' },
          { label: '10 minutes', value: '600', emoji: '⏱️' },
          { label: '1 hour', value: '3600', emoji: '🕐' },
          { label: '1 day', value: '86400', emoji: '📅' },
          { label: '1 week', value: '604800', emoji: '📅' },
        ]))],
        ephemeral: true,
      });
    }

    if (action === 'warn') {
      if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
      const protectedReason = protectedTargetReason(g, member);
      if (protectedReason) return err(i, `🛡️ You can't moderate ${protectedReason}.`);
      return i.reply({
        content: `⚠️ Warning **${member.user.username}** — pick a reason:`,
        components: [row(menu('usr:warnReason', '⚠️ Pick a reason…', [
          { label: 'Breaking server rules', value: 'Breaking server rules', emoji: '📜' },
          { label: 'Spamming', value: 'Spamming', emoji: '📢' },
          { label: 'Toxic behavior', value: 'Toxic behavior', emoji: '☠️' },
          { label: 'Inappropriate content', value: 'Inappropriate content', emoji: '🚫' },
          { label: 'Advertising', value: 'Advertising', emoji: '📣' },
          { label: 'Harassment', value: 'Harassment', emoji: '😤' },
          { label: 'Final warning (any reason)', value: 'Final warning', emoji: '🚨' },
        ]))],
        ephemeral: true,
      });
    }

    if (action === 'warnings') {
      const list = g.warns?.[member.id] ?? [];
      if (!list.length) return i.reply({ content: `✅ ${member.user} has no warnings.`, ephemeral: true });
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`📋 Warnings — ${member.user.username} (${list.length})`)
          .setDescription(list.map((w, x) => `**${x + 1}.** ${w.reason} — <@${w.by}> <t:${Math.floor(w.at / 1000)}:R>`).join('\n'))
          .setColor(colors.warn)],
        ephemeral: true,
      });
    }

    if (action === 'clearwarnings') {
      if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
      if (g.warns) delete g.warns[member.id];
      ctx.save();
      return i.update({ embeds: [userEmbed(member, g)], components: userRows(member) });
    }

    if (action === 'roleAdd') {
      if (!i.member.permissions.has(PermissionFlagsBits.ManageRoles)) return err(i, 'You need the **Manage Roles** permission.');
      return i.reply({ content: `➕ Pick a role to give ${member.user}:`, components: [row(menu('usr:roleAddSel', '🏷️ Pick a role…', rolesMenu(i)))], ephemeral: true });
    }
    if (action === 'roleRemove') {
      if (!i.member.permissions.has(PermissionFlagsBits.ManageRoles)) return err(i, 'You need the **Manage Roles** permission.');
      const protectedReason = protectedTargetReason(g, member);
      if (protectedReason) return err(i, `🛡️ You can't modify roles on ${protectedReason}.`);
      const options = member.roles.cache.filter(r => r.id !== i.guild.id).first(25).map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🏷️' }));
      if (!options.length) return err(i, `${member.user} has no removable roles.`);
      return i.reply({ content: `➖ Pick a role to remove from ${member.user}:`, components: [row(menu('usr:roleRemoveSel', '🏷️ Pick a role…', options))], ephemeral: true });
    }

    if (action === 'nickname') {
      if (!i.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return err(i, 'You need the **Manage Nicknames** permission.');
      const protectedReason = protectedTargetReason(g, member);
      if (protectedReason) return err(i, `🛡️ You can't rename ${protectedReason}.`);
      const modal = new ModalBuilder().setCustomId('usr:nickModal').setTitle('Change Nickname');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('New nickname (blank = reset)').setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(false)));
      return i.showModal(modal);
    }
    if (action === 'dm') {
      if (!i.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return err(i, 'You need the **Moderate Members** permission.');
      const modal = new ModalBuilder().setCustomId('usr:dmModal').setTitle('Send DM');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Message').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)));
      return i.showModal(modal);
    }
  },
  async onSelect(i, ctx) {
    const memberId = i.client.userPanels?.get(i.user.id);
    const member = memberId && await i.guild.members.fetch(memberId).catch(() => null);
    if (!member) return err(i, 'Session expired — run `/user` again.');
    const g = ctx.guild(i.guildId);

    if (i.customId === 'usr:kickReason') {
      const reason = i.values[0];
      await member.send(`You were kicked from **${i.guild.name}**. Reason: ${reason}`).catch(() => {});
      await member.kick(`[by ${i.user.tag}] ${reason}`);
      return i.update({ content: `👢 Kicked ${member.user} — *${reason}*`, components: [] });
    }

    if (i.customId === 'usr:banReason' || i.customId === 'usr:banDays') {
      const s = i.client.userBan?.get(i.user.id);
      if (!s) return err(i, 'Session expired — click Ban again.');
      if (i.customId === 'usr:banReason') s.reason = i.values[0];
      else s.days = parseInt(i.values[0], 10);
      return i.update({ content: `🔨 Banning — Reason: *${s.reason}* • Message wipe: **${s.days ? `${s.days} day(s)` : 'none'}**\nClick ✅ Confirm when ready.` });
    }

    if (i.customId === 'usr:timeoutDur') {
      const seconds = parseInt(i.values[0], 10);
      if (!member.moderatable) return err(i, "I can't timeout that member.");
      await member.timeout(seconds * 1000, `[by ${i.user.tag}]`);
      return i.update({ content: `🔇 ${member.user} timed out for **${seconds < 3600 ? `${seconds / 60} min` : seconds / 3600 < 24 ? `${seconds / 3600} hr` : `${seconds / 86400} day(s)`}**.`, components: [] });
    }

    if (i.customId === 'usr:warnReason') {
      const reason = i.values[0];
      g.warns ??= {};
      g.warns[member.id] ??= [];
      g.warns[member.id].push({ by: i.user.id, reason, at: Date.now() });
      ctx.save();
      await member.send(`⚠️ You were warned in **${i.guild.name}**: ${reason}`).catch(() => {});
      return i.update({ content: `⚠️ Warned ${member.user} — *${reason}* (they now have **${g.warns[member.id].length}** warning(s)).`, components: [] });
    }

    if (i.customId === 'usr:roleAddSel' || i.customId === 'usr:roleRemoveSel') {
      const role = await i.guild.roles.fetch(i.values[0]).catch(() => null);
      if (!role || !role.editable) return err(i, "I can't manage that role.");
      if (i.customId === 'usr:roleAddSel') await member.roles.add(role);
      else await member.roles.remove(role);
      return i.update({ content: `${i.customId === 'usr:roleAddSel' ? '➕ Gave' : '➖ Removed'} ${role} ${i.customId === 'usr:roleAddSel' ? 'to' : 'from'} ${member.user}.`, components: [] });
    }
  },
  async onModal(i) {
    const memberId = i.client.userPanels?.get(i.user.id);
    const member = memberId && await i.guild.members.fetch(memberId).catch(() => null);
    if (!member) return err(i, 'Session expired — run `/user` again.');

    if (i.customId === 'usr:nickModal') {
      const nick = i.fields.getTextInputValue('v').trim();
      await member.setNickname(nick || null).catch(() => {});
      return i.reply({ content: nick ? `✏️ Nickname of ${member.user} set to **${nick}**.` : `✏️ Reset ${member.user}'s nickname.`, ephemeral: true });
    }
    if (i.customId === 'usr:dmModal') {
      const sent = await member.send(i.fields.getTextInputValue('v')).catch(() => null);
      return i.reply({ content: sent ? `📨 Sent to ${member.user}.` : "Couldn't DM that user — their DMs may be closed.", ephemeral: true });
    }
  },
};
