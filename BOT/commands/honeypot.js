const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, textChannels } = require('./_shared');

/* ═══════════════════════════ HONEYPOT ═══════════════════════════ */
const HP_DEFAULTS = () => ({
  enabled: false,
  channelIds: [],
  punishment: 'softban',
  timeoutMinutes: 60,
  message: {
    title: '🚫 STOP — DO NOT TYPE',
    description: 'This channel is protected by the server honeypot.\nSending a message may result in automatic moderation action.',
  },
  dmMessage: '🍯 You were punished (**{punishment}**) in **{server}** for typing in a protected channel.\nYou can rejoin here: {invite}',
  whitelist: [],
  logChannelId: null,
  strikes: {},
  warnMessageIds: {},   // channelId -> live trap warning message id
});

function hpState(g) {
  const d = HP_DEFAULTS();
  const h = g.honeypot ??= d;
  h.channelIds ??= d.channelIds;
  h.message ??= d.message;
  h.message.title ??= d.message.title;
  h.message.description ??= d.message.description;
  h.dmMessage ??= d.dmMessage;
  h.whitelist ??= d.whitelist;
  h.strikes ??= d.strikes;
  h.warnMessageIds ??= d.warnMessageIds;
  h.timeoutMinutes ??= d.timeoutMinutes;
  return h;
}

const hpPunishments = {
  softban:  { label: 'Softban',  emoji: '🔨', desc: 'Ban + immediate unban (deletes messages)' },
  ban:      { label: 'Ban',      emoji: '⚒️', desc: 'Permanent ban' },
  kick:     { label: 'Kick',     emoji: '👢', desc: 'Kick from the server' },
  timeout:  { label: 'Timeout',  emoji: '⏳', desc: 'Timed-out for a set duration' },
  none:     { label: 'Log only', emoji: '📋', desc: 'No punishment, log only' },
};

function hpWarnPayload(h) {
  const p = hpPunishments[h.punishment] ?? hpPunishments.softban;
  return {
    embeds: [new EmbedBuilder()
      .setTitle(h.message.title)
      .setDescription(h.message.description)
      .setColor(colors.bad)
      .setFooter({ text: `Punishment: ${p.label}` })],
    components: [row(new ButtonBuilder()
      .setCustomId('hpot:info')
      .setLabel(`Punishment: ${p.label}`)
      .setEmoji(p.emoji)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true))],
  };
}

const command = {
  data: new SlashCommandBuilder().setName('honeypot').setDescription('🍯 Anti-raid trap channels — all buttons, one command')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ns: 'hpot',
  embed(g) {
    const h = hpState(g);
    const p = hpPunishments[h.punishment] ?? hpPunishments.softban;
    return new EmbedBuilder()
      .setTitle('🍯 Honeypot Control Panel')
      .setDescription(`**Status:** ${h.enabled ? '🟢 Deployed' : '🔴 Disabled'}\n**Traps:** ${h.channelIds.length ? h.channelIds.map(c => `<#${c}>`).join(', ') : '*none*'}\n**Punishment:** ${p.emoji} ${p.label}\n**Whitelist roles:** ${h.whitelist.length ? h.whitelist.map(r => `<@&${r}>`).join(', ') : '*none*'}\n**Log channel:** ${h.logChannelId ? `<#${h.logChannelId}>` : '*not set*'}`)
      .setColor(h.enabled ? colors.good : colors.main);
  },
  panel(h) {
    return [
      row(
        new ButtonBuilder().setCustomId('hpot:toggle').setLabel(h.enabled ? '⬇️ Undeploy' : '🚀 Deploy').setStyle(h.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId('hpot:channels').setLabel('🍯 Trap Channels').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hpot:punish').setLabel('⚖️ Punishment').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('hpot:message').setLabel('✉️ Message').setStyle(ButtonStyle.Secondary),
      ),
      row(
        new ButtonBuilder().setCustomId('hpot:dm').setLabel('📩 DM Message').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:whitelist').setLabel('🛡️ Whitelist').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:logs').setLabel('📜 Log Channel').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:stats').setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('hpot:close').setLabel('✖️').setStyle(ButtonStyle.Secondary),
      ),
    ];
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);
    ctx.save();
    return i.reply({ embeds: [this.embed(g)], components: this.panel(h), ephemeral: true });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);
    const action = i.customId.split(':')[1];

    if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }
    if (action === 'info') return; /* disabled button on live trap warnings */

    if (action === 'toggle') {
      h.enabled = !h.enabled;
      h.warnMessageIds ??= {};
      for (const chId of h.channelIds) {
        const ch = await i.guild.channels.fetch(chId).catch(() => null);
        if (!ch) continue;
        const oldId = h.warnMessageIds[chId];
        if (oldId) await ch.messages.delete(oldId).catch(() => {});
        delete h.warnMessageIds[chId];
        if (h.enabled) {
          const msg = await ch.send(hpWarnPayload(h)).catch(() => null);
          if (msg) h.warnMessageIds[chId] = msg.id;
        }
      }
      ctx.save();
      return i.update({ embeds: [this.embed(g)], components: this.panel(h) });
    }

    if (action === 'channels') {
      const opts = textChannels(i, 25).map(c => ({
        label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🍯',
        default: h.channelIds.includes(c.id),
      }));
      if (!opts.length) return err(i, 'No text channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:channelsSel')
        .setPlaceholder('🍯 Pick trap channels (multi-select)…')
        .setMinValues(0).setMaxValues(Math.min(opts.length, 25)).addOptions(opts);
      return i.reply({ content: '🍯 Select every channel that should be a trap. Selection **replaces** the current list.', components: [row(sel)], ephemeral: true });
    }

    if (action === 'punish') {
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:punishSel').setPlaceholder('⚖️ Pick a punishment…')
        .addOptions(Object.entries(hpPunishments).map(([k, v]) => ({
          label: v.label, value: k, emoji: v.emoji, description: v.desc, default: h.punishment === k,
        })));
      return i.reply({ components: [row(sel)], ephemeral: true });
    }

    if (action === 'message') {
      const modal = new ModalBuilder().setCustomId('hpot:msgModal').setTitle('Trap Message');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(h.message.title).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('Description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(h.message.description).setRequired(true)),
      );
      return i.showModal(modal);
    }

    if (action === 'dm') {
      const modal = new ModalBuilder().setCustomId('hpot:dmModal').setTitle('Punishment DM');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('v').setLabel('DM text ({punishment}, {server})')
          .setStyle(TextInputStyle.Paragraph).setMaxLength(1000)
          .setValue(h.dmMessage).setRequired(true)));
      return i.showModal(modal);
    }

    if (action === 'whitelist') {
      const opts = i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25)
        .map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🛡️' }));
      if (!opts.length) return err(i, 'No roles available.');
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:wlSel').setPlaceholder('🛡️ Immune roles (multi-select)…')
        .setMinValues(0).setMaxValues(opts.length).addOptions(opts);
      return i.reply({ content: '🛡️ Members with these roles can type in traps safely. Selection replaces the current list.', components: [row(sel)], ephemeral: true });
    }

    if (action === 'logs') {
      const opts = textChannels(i, 25).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜', default: h.logChannelId === c.id }));
      if (!opts.length) return err(i, 'No text channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId('hpot:logsSel').setPlaceholder('📜 Evidence log channel…').addOptions(opts);
      return i.reply({ components: [row(sel)], ephemeral: true });
    }

    if (action === 'stats') {
      const total = Object.values(h.strikes ?? {}).reduce((a, b) => a + b, 0);
      return i.reply({
        embeds: [new EmbedBuilder().setTitle('📊 Honeypot Stats')
          .setDescription(`**Total triggers:** ${total}\n**Unique users caught:** ${Object.keys(h.strikes ?? {}).length}\n**Active traps:** ${h.channelIds.length}`)
          .setColor(colors.main)],
        ephemeral: true,
      });
    }
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);
    const action = i.customId.split(':')[1];

    if (action === 'channelsSel') {
      h.channelIds = i.values;
      h.warnMessageIds ??= {};
      await i.deferUpdate();
      for (const chId of h.channelIds) {
        if (!h.enabled || h.warnMessageIds[chId]) continue;
        const ch = await i.guild.channels.fetch(chId).catch(() => null);
        if (!ch) continue;
        const msg = await ch.send(hpWarnPayload(h)).catch(() => null);
        if (msg) h.warnMessageIds[chId] = msg.id;
      }
      ctx.save();
      return i.editReply({ content: `✅ Traps set: ${h.channelIds.length ? h.channelIds.map(c => `<#${c}>`).join(', ') : '*none*'}`, components: [] });
    }

    if (action === 'punishSel') {
      h.punishment = i.values[0];
      ctx.save();
      /* refresh live trap warnings so the footer shows the new punishment */
      for (const [chId, msgId] of Object.entries(h.warnMessageIds ?? {})) {
        await i.guild.channels.fetch(chId).then(ch => ch?.messages.edit(msgId, hpWarnPayload(h))).catch(() => {});
      }
      return i.update({ content: `⚖️ Punishment: **${hpPunishments[h.punishment].label}**.`, components: [] });
    }

    if (action === 'wlSel') { h.whitelist = i.values; ctx.save(); return i.update({ content: `🛡️ Whitelist: ${h.whitelist.length ? h.whitelist.map(r => `<@&${r}>`).join(', ') : '*empty*'}`, components: [] }); }
    if (action === 'logsSel') { h.logChannelId = i.values[0] ?? null; ctx.save(); return i.update({ content: `📜 Logs: ${h.logChannelId ? `<#${h.logChannelId}>` : '*disabled*'}`, components: [] }); }
  },
  async onModal(i, ctx) {
    const g = ctx.guild(i.guildId);
    const h = hpState(g);

    if (i.customId === 'hpot:msgModal') {
      h.message.title = i.fields.getTextInputValue('t');
      h.message.description = i.fields.getTextInputValue('d');
      ctx.save();
      await i.deferReply({ ephemeral: true });
      for (const [chId, msgId] of Object.entries(h.warnMessageIds ?? {})) {
        await i.guild.channels.fetch(chId).then(ch => ch?.messages.edit(msgId, hpWarnPayload(h))).catch(() => {});
      }
      return i.editReply({ content: '✅ Trap message updated everywhere. Preview:', ...hpWarnPayload(h) });
    }

    if (i.customId === 'hpot:dmModal') {
      h.dmMessage = i.fields.getTextInputValue('v');
      ctx.save();
      return i.reply({ content: `✅ Punishment DM updated:\n> ${h.dmMessage}`, ephemeral: true });
    }
  },
};

/* ═══════════════════ honeypot engine (message listener) ═══════════════════ */
function registerHoneypot(client, ctx) {
  client.on('messageCreate', async (msg) => {
    try {
      if (!msg.guild || msg.author.bot || msg.member?.permissions.has(PermissionFlagsBits.Administrator)) return;
      const g = ctx.guild(msg.guildId);
      const h = g ? hpState(g) : null;
      if (!h?.enabled || !h.channelIds?.includes(msg.channelId)) return;
      if (h.whitelist?.some(r => msg.member?.roles.cache.has(r))) return;
      await msg.delete().catch(() => {});

      h.strikes ??= {};
      h.strikes[msg.author.id] = (h.strikes[msg.author.id] ?? 0) + 1;
      ctx.save();

      const p = hpPunishments[h.punishment] ?? hpPunishments.softban;
      let invite = '';
      try {
        invite = (await msg.guild.invites.create(msg.channel, { maxAge: 86400, maxUses: 1, unique: true })).url;
      } catch { /* missing CreateInstantInvite perms — send without a link */ }
      const dm = (h.dmMessage || HP_DEFAULTS().dmMessage)
        .replaceAll('{punishment}', p.label)
        .replaceAll('{server}', msg.guild.name)
        .replaceAll('{invite}', invite);
      await msg.author.send(dm).catch(() => {});

      if (h.punishment === 'softban') {
        await msg.member.ban({ deleteMessageSeconds: 86400, reason: '🍯 Honeypot' })
          .then(() => msg.guild.members.unban(msg.author.id).catch(() => {}))
          .catch(() => {});
      } else if (h.punishment === 'ban') {
        await msg.member.ban({ reason: '🍯 Honeypot' }).catch(() => {});
      } else if (h.punishment === 'kick') {
        await msg.member.kick('🍯 Honeypot').catch(() => {});
      } else if (h.punishment === 'timeout') {
        await msg.member.timeout((h.timeoutMinutes ?? 60) * 60_000, '🍯 Honeypot').catch(() => {});
      }

      if (h.logChannelId) {
        const logCh = await msg.guild.channels.fetch(h.logChannelId).catch(() => null);
        if (logCh) {
          logCh.send({
            embeds: [new EmbedBuilder()
              .setTitle(`🍯 Honeypot — ${p.label}`)
              .setDescription(`<@${msg.author.id}> (${msg.author.tag}) typed in <#${msg.channelId}>\n**Strikes:** ${h.strikes[msg.author.id]}\n\`\`\`${(msg.content || '*no text*').slice(0, 500)}\`\`\``)
              .setColor(colors.bad)
              .setTimestamp()],
          }).catch(() => {});
        }
      }

    } catch { /* never crash the bot over honeypot */ }
  });
}

module.exports = { command, registerHoneypot, hpState, hpWarnPayload };
