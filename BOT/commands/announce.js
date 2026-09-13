const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, menu, textChannels } = require('./_shared');

/* ═══════════════════════════ announce builder state ═══════════════════════════ */
const annSessions = new Map(); /* userId -> session */
const ANN_COLORS = [
  { label: 'Blurple (default)', hex: '#5865F2' }, { label: 'Green', hex: '#57F287' },
  { label: 'Red (urgent)', hex: '#ED4245' }, { label: 'Yellow (warning)', hex: '#FEE75C' },
  { label: 'Pink', hex: '#EB459E' }, { label: 'Cyan', hex: '#00B0F4' },
];
const ANN_STYLES = {
  standard: { label: '📢 Standard', author: 'Announcement', footer: '📢 Server Announcement' },
  update: { label: '🆕 Update', author: 'Update', footer: "🆕 What's New" },
  event: { label: '🎉 Event', author: 'Event', footer: '🎉 Upcoming Event' },
  warning: { label: '⚠️ Warning', author: 'Warning', footer: '⚠️ Important Notice' },
  maintenance: { label: '🔧 Maintenance', author: 'Maintenance', footer: '🔧 Scheduled Work' },
};
const ANN_TEMPLATES = [
  { label: '📢 Standard news', title: '📢 Announcement', body: 'We have some exciting news to share!\n\nStay tuned for more information.' },
  { label: '🆕 Update changelog', title: '🆕 Update', body: 'A new update just dropped:\n\n• Improvement one\n• Improvement two\n\nLet us know what you think!' },
  { label: '🎉 Event invite', title: '🎉 Event', body: "Join us for a special event!\n\n📅 When: soon\n📍 Where: here\n\nDon't miss it!" },
  { label: '⚠️ Status update', title: '⚠️ Status', body: 'We are aware of an issue and are working on a fix.\n\nThanks for your patience.' },
];
const newAnnSession = () => ({
  channelId: null, ping: 'none', color: '#5865F2', style: 'standard',
  title: '📢 Announcement', body: null, banner: null, timestamp: true, thumbnail: 'bot',
});

function annEmbed(i, s) {
  const st = ANN_STYLES[s.style];
  const e = new EmbedBuilder()
    .setTitle(s.title)
    .setDescription(s.body ?? '*Click ✍️ Write Message to add the announcement text.*')
    .setColor(parseInt(s.color.replace('#', ''), 16) || colors.main)
    .setAuthor({ name: `${st.author} • ${i.user.username}`, iconURL: i.user.displayAvatarURL() })
    .setFooter({ text: st.footer });
  if (s.timestamp) e.setTimestamp();
  if (s.thumbnail === 'bot') e.setThumbnail(i.client.user.displayAvatarURL());
  if (s.thumbnail === 'server' && i.guild.iconURL()) e.setThumbnail(i.guild.iconURL());
  if (s.banner) e.setImage(s.banner);
  return e;
}

function annPanel(s) {
  const pingLabel = { everyone: '📣 @everyone', here: '📣 @here', none: '🔕 No ping', role: '🏷️ Role ping' };
  return [
    row(
      new ButtonBuilder().setCustomId('ann:title').setLabel('Title').setEmoji('🏷️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ann:body').setLabel(s.body ? '✅ Message Written' : '✍️ Write Message').setStyle(s.body ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ann:banner').setLabel('Banner').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:timestamp').setLabel(`Timestamp: ${s.timestamp ? 'On' : 'Off'}`).setEmoji('🕒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:thumb').setLabel(`Thumbnail: ${s.thumbnail}`).setEmoji('👤').setStyle(ButtonStyle.Secondary),
    ),
    row(menu('ann:color', '🎨 Pick a color…',
      ANN_COLORS.map(c => ({ label: c.label, value: c.hex, emoji: '🎨', default: c.hex === s.color })))),
    row(menu('ann:ping', '📣 Who gets pinged…',
      ['everyone', 'here', 'none', 'role'].map(p => ({ label: pingLabel[p], value: p, default: s.ping === p })))),
    row(
      new ButtonBuilder().setCustomId('ann:send').setLabel('Send').setEmoji('🚀').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ann:test').setLabel('Preview Here').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ann:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function annChannelRow(i, s) {
  return row(menu('ann:channel', '📺 Pick the announcement channel…',
    textChannels(i).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: c.id === s.channelId }))));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('📢 Build a polished announcement with a live visual editor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  ns: 'ann',
  async run(i) {
    const s = newAnnSession();
    s.channelId = i.channelId;
    annSessions.set(i.user.id, s);
    return i.reply({
      embeds: [annEmbed(i, s),
        new EmbedBuilder().setTitle('📢 Announcement Builder').setColor(colors.main)
          .setDescription('Build your announcement live — every change shows in the preview above.\n1️⃣ Pick the **channel** below\n2️⃣ Pick **ping**, **color** and optionally a **template**\n3️⃣ Click **✍️ Write Message** to add your text\n4️⃣ Hit **🚀 Send**')],
      components: [annChannelRow(i, s), ...annPanel(s)],
      ephemeral: true,
    });
  },
  async onButton(i) {
    const s = annSessions.get(i.user.id);
    if (!s) return err(i, 'This builder expired — run `/announce` again.');
    const action = i.customId.split(':')[1];

    if (action === 'title') {
      const modal = new ModalBuilder().setCustomId('ann:titleModal').setTitle('Announcement Title');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('v').setLabel('Title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(s.title).setRequired(true)));
      return i.showModal(modal);
    }
    if (action === 'body') {
      const modal = new ModalBuilder().setCustomId('ann:bodyModal').setTitle('Announcement Message');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('v').setLabel('Message (markdown supported)').setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setValue(s.body ?? '').setRequired(true)));
      return i.showModal(modal);
    }
    if (action === 'banner') {
      const modal = new ModalBuilder().setCustomId('ann:bannerModal').setTitle('Banner Image');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('v').setLabel('Image URL (leave blank to remove)').setStyle(TextInputStyle.Short).setValue(s.banner ?? '').setRequired(false)));
      return i.showModal(modal);
    }
    if (action === 'timestamp') { s.timestamp = !s.timestamp; return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] }); }
    if (action === 'thumb') { s.thumbnail = { bot: 'server', server: 'none', none: 'bot' }[s.thumbnail]; return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] }); }
    if (action === 'cancel') { annSessions.delete(i.user.id); return i.update({ content: '✖️ Announcement cancelled.', embeds: [], components: [] }); }

    if (action === 'test') {
      await i.channel.send({ embeds: [annEmbed(i, s)], content: s.ping === 'everyone' ? '@everyone' : s.ping === 'here' ? '@here' : undefined });
      return i.reply({ content: '👁️ Preview posted in this channel (pings are real — preview in a quiet channel!).', ephemeral: true });
    }
    if (action === 'send') {
      const ch = await i.guild.channels.fetch(s.channelId).catch(() => null);
      if (!ch) return err(i, 'Pick a valid channel first.');
      const content = s.ping === 'role' ? (s.roleMention ?? '')
        : s.ping === 'everyone' ? '@everyone' : s.ping === 'here' ? '@here' : undefined;
      await ch.send({ content, embeds: [annEmbed(i, s)] }).catch(() => {});
      annSessions.delete(i.user.id);
      return i.update({ content: `🚀 Announcement sent in ${ch}.`, embeds: [], components: [] });
    }
  },
  async onSelect(i) {
    const s = annSessions.get(i.user.id);
    if (!s) return err(i, 'This builder expired — run `/announce` again.');
    if (i.customId === 'ann:channel') s.channelId = i.values[0];
    if (i.customId === 'ann:color') s.color = i.values[0];
    if (i.customId === 'ann:ping') {
      s.ping = i.values[0];
      if (s.ping === 'role') {
        const roleSel = new StringSelectMenuBuilder().setCustomId('ann:rolePing').setPlaceholder('🏷️ Pick the role to ping…')
          .addOptions(i.guild.roles.cache.filter(r => !r.managed && r.id !== i.guild.id).first(25)
            .map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🏷️' })));
        return i.update({ components: [annChannelRow(i, s), row(roleSel), ...annPanel(s).slice(1)] });
      }
    }
    if (i.customId === 'ann:rolePing') s.roleMention = `<@&${i.values[0]}>`;
    if (i.customId === 'ann:template') {
      const t = ANN_TEMPLATES.find(t => t.label === i.values[0]);
      if (t) { s.title = t.title; s.body = t.body; }
    }
    return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] });
  },
  async onModal(i) {
    const s = annSessions.get(i.user.id);
    if (!s) return err(i, 'This builder expired — run `/announce` again.');
    const v = i.fields.getTextInputValue('v');
    if (i.customId === 'ann:titleModal') s.title = v;
    if (i.customId === 'ann:bodyModal') s.body = v;
    if (i.customId === 'ann:bannerModal') s.banner = v.trim() || null;
    return i.update({ embeds: [annEmbed(i, s)], components: [annChannelRow(i, s), ...annPanel(s)] });
  },
};
