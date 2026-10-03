const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, menu, textChannels } = require('./_shared');

/* ═══════════════ announce builder state ═══════════════ */
const annSessions = new Map(); // userId -> session

const ANN_COLORS = [
  { label: 'Blurple', hex: '#5865F2' },
  { label: 'Green',   hex: '#57F287' },
  { label: 'Red',     hex: '#ED4245' },
  { label: 'Yellow',  hex: '#FEE75C' },
  { label: 'Pink',    hex: '#EB459E' },
  { label: 'Cyan',    hex: '#00B0F4' },
  { label: 'Orange',  hex: '#E67E22' },
  { label: 'Purple',  hex: '#9B59B6' },
  { label: 'Grey',    hex: '#95A5A6' },
  { label: 'Dark',    hex: '#2B2D31' },
];
const ANN_COLOR_BY_HEX = Object.fromEntries(ANN_COLORS.map(c => [c.hex.toLowerCase(), c.label]));

const ANN_STYLES = {
  standard:    { label: 'Standard',    emoji: '📢', author: 'Announcement', footer: 'Server Announcement' },
  update:      { label: 'Update',      emoji: '🆕', author: 'Update',       footer: "What's New" },
  event:       { label: 'Event',       emoji: '🎉', author: 'Event',        footer: 'Upcoming Event' },
  warning:     { label: 'Warning',     emoji: '⚠️', author: 'Warning',      footer: 'Important Notice' },
  maintenance: { label: 'Maintenance', emoji: '🔧', author: 'Maintenance',  footer: 'Scheduled Work' },
};

const ANN_TEMPLATES = [
  { label: 'Standard news',    title: '📢 Announcement', body: 'We have some exciting news to share!\n\nStay tuned for more information.' },
  { label: 'Update changelog', title: '🆕 Update',       body: 'A new update just dropped:\n\n• Improvement one\n• Improvement two\n\nLet us know what you think!' },
  { label: 'Event invite',     title: '🎉 Event',        body: "Join us for a special event!\n\n📅 When: soon\n📍 Where: here\n\nDon't miss it!" },
  { label: 'Status update',    title: '⚠️ Status',       body: 'We are aware of an issue and are working on a fix.\n\nThanks for your patience.' },
];

const PINGS = ['everyone', 'here', 'none', 'role'];
const PING_LABEL = { everyone: '@everyone', here: '@here', none: 'No ping', role: 'Role ping' };
const PING_EMOJI = { everyone: '📣', here: '📣', none: '🔕', role: '🏷️' };

const newAnnSession = () => ({
  channelId: null, ping: 'none', color: '#5865F2', style: 'standard',
  title: '📢 Announcement', body: null, banner: null,
  timestamp: true, thumbnail: 'bot', author: null, roleMention: null,
});

/* ═══════════════ rendering ═══════════════ */
function annEmbed(i, s) {
  const st = ANN_STYLES[s.style];
  const e = new EmbedBuilder()
    .setTitle(s.title)
    .setDescription(s.body ?? '*Click ✍️ Write Message to add the announcement text.*')
    .setColor(parseInt(s.color.replace('#', ''), 16) || colors.main)
    .setAuthor({
      name: `${st.author} • ${s.author ?? i.user.username}`,
      iconURL: i.user.displayAvatarURL(),
    })
    .setFooter({ text: st.footer });
  if (s.timestamp) e.setTimestamp();
  if (s.thumbnail === 'bot') e.setThumbnail(i.client.user.displayAvatarURL());
  if (s.thumbnail === 'server' && i.guild.iconURL()) e.setThumbnail(i.guild.iconURL());
  if (s.banner) e.setImage(s.banner);
  return e;
}

function statusEmbed(i, s) {
  const ch = s.channelId ? `<#${s.channelId}>` : '*none*';
  const colorLabel = ANN_COLOR_BY_HEX[s.color.toLowerCase()] ?? 'Custom';
  return new EmbedBuilder().setColor(colors.main).setTitle('📢 Announcement Builder')
    .setDescription(
      `**Target:** ${ch}\n` +
      `**Ping:** ${PING_EMOJI[s.ping]} ${PING_LABEL[s.ping]}\n` +
      `**Color:** ${colorLabel}\n` +
      `**Style:** ${ANN_STYLES[s.style].emoji} ${ANN_STYLES[s.style].label}\n` +
      `**Message:** ${s.body ? '✅ Written' : '❌ Not written'}\n\n` +
      'Every change updates the preview above. Use the controls below, then hit 🚀 Send.',
    );
}

function contentRow(s) {
  return row(
    new ButtonBuilder().setCustomId('ann:title').setLabel('Title').setEmoji('🏷️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ann:body').setLabel(s.body ? 'Edit Message ✅' : 'Write Message ✍️')
      .setStyle(s.body ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ann:banner').setLabel('Banner').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ann:author').setLabel('Author').setEmoji('✒️').setStyle(ButtonStyle.Secondary),
  );
}

function appearanceRow(s) {
  return row(
    new ButtonBuilder().setCustomId('ann:thumb').setLabel(`Thumb: ${s.thumbnail}`).setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ann:timestamp').setLabel(`Timestamp: ${s.timestamp ? 'On' : 'Off'}`).setEmoji('🕒').setStyle(ButtonStyle.Secondary),
  );
}

function menuRows(s) {
  return [
    row(menu('ann:color', '🎨 Pick a color…',
      ANN_COLORS.map(c => ({ label: c.label, value: c.hex, emoji: '🎨', default: c.hex.toLowerCase() === s.color.toLowerCase() })))),
  ];
}

function actionRow(s) {
  return row(
    new ButtonBuilder().setCustomId('ann:send').setLabel('Send').setEmoji('🚀').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ann:test').setLabel('Preview Here').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ann:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  );
}

function annChannelRow(i, s) {
  return row(menu('ann:channel', '📺 Pick the announcement channel…',
    textChannels(i).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: c.id === s.channelId }))));
}

/* All rows, top to bottom — one source of truth so nothing drifts.
   Discord caps message components at 5 rows, so this must stay within that limit. */
function fullPanel(i, s) {
  return [annChannelRow(i, s), contentRow(s), appearanceRow(s), ...menuRows(s), actionRow(s)];
}

function pingContent(s) {
  return s.ping === 'everyone' ? '@everyone'
    : s.ping === 'here' ? '@here'
    : s.ping === 'role' ? (s.roleMention ?? undefined)
    : undefined;
}

/* ═══════════════ command ═══════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Build a polished announcement with a live visual editor')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  ns: 'ann',
  async run(i) {
    const s = newAnnSession();
    s.channelId = i.channelId;
    annSessions.set(i.user.id, s);
    return i.reply({
      embeds: [annEmbed(i, s), statusEmbed(i, s)],
      components: fullPanel(i, s),
      ephemeral: true,
    });
  },

  async onButton(i) {
    const s = annSessions.get(i.user.id);
    if (!s) return err(i, 'This builder expired — run `/announce` again.');
    const action = i.customId.split(':')[1];
    const modal = (id, title, label, value, { para = false, required = true, max = 2000 } = {}) => {
      const m = new ModalBuilder().setCustomId(id).setTitle(title);
      m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('v').setLabel(label)
          .setStyle(para ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setMaxLength(max).setValue(value ?? '').setRequired(required)));
      return i.showModal(m);
    };

    switch (action) {
      case 'title':   return modal('ann:titleModal', 'Announcement Title', 'Title', s.title, { max: 256 });
      case 'body':    return modal('ann:bodyModal', 'Announcement Message', 'Message (markdown supported)', s.body, { para: true });
      case 'banner':  return modal('ann:bannerModal', 'Banner Image', 'Image URL (leave blank to remove)', s.banner, { required: false, max: 512 });
      case 'author':  return modal('ann:authorModal', 'Author Name', 'Shown above the embed (blank = default)', s.author, { required: false, max: 100 });

      case 'timestamp':
        s.timestamp = !s.timestamp;
        return i.update({ embeds: [annEmbed(i, s), statusEmbed(i, s)], components: fullPanel(i, s) });

      case 'thumb':
        s.thumbnail = { bot: 'server', server: 'none', none: 'bot' }[s.thumbnail];
        return i.update({ embeds: [annEmbed(i, s), statusEmbed(i, s)], components: fullPanel(i, s) });

      case 'cancel':
        annSessions.delete(i.user.id);
        return i.update({ content: '✖️ Announcement cancelled.', embeds: [], components: [] });

      case 'test': {
        await i.channel.send({ content: pingContent(s), embeds: [annEmbed(i, s)] });
        return i.reply({ content: '👁️ Preview posted in this channel (pings are real — preview in a quiet channel!).', ephemeral: true });
      }

      case 'send': {
        const ch = await i.guild.channels.fetch(s.channelId).catch(() => null);
        if (!ch) return err(i, 'Pick a valid channel first.');
        await ch.send({ content: pingContent(s), embeds: [annEmbed(i, s)] }).catch(() => {});
        annSessions.delete(i.user.id);
        return i.update({ content: `🚀 Announcement sent in ${ch}.`, embeds: [], components: [] });
      }
    }
  },

  async onSelect(i) {
    const s = annSessions.get(i.user.id);
    if (!s) return err(i, 'This builder expired — run `/announce` again.');

    switch (i.customId) {
      case 'ann:channel':   s.channelId = i.values[0]; break;
      case 'ann:color':     s.color = i.values[0]; break;
      case 'ann:style':     s.style = i.values[0]; break;
      case 'ann:rolePing':  s.roleMention = `<@&${i.values[0]}>`; break;

      case 'ann:template': {
        const t = ANN_TEMPLATES[Number(i.values[0])];
        if (t) { s.title = t.title; s.body = t.body; }
        break;
      }

      case 'ann:ping': {
        s.ping = i.values[0];
        if (s.ping !== 'role') break;
        const options = i.guild.roles.cache
          .filter(r => !r.managed && r.id !== i.guild.id)
          .first(25)
          .map(r => ({ label: r.name.slice(0, 100), value: r.id, emoji: '🏷️' }));
        if (!options.length) { s.ping = 'none'; break; }
        const roleSel = new StringSelectMenuBuilder()
          .setCustomId('ann:rolePing').setPlaceholder('🏷️ Pick the role to ping…').addOptions(options);
        const rows = [annChannelRow(i, s), contentRow(s), appearanceRow(s), row(roleSel), actionRow(s)];
        return i.update({
          embeds: [annEmbed(i, s), statusEmbed(i, s)],
          components: rows.slice(0, 5),
        });
      }
    }

    return i.update({ embeds: [annEmbed(i, s), statusEmbed(i, s)], components: fullPanel(i, s) });
  },

  async onModal(i) {
    const s = annSessions.get(i.user.id);
    if (!s) return err(i, 'This builder expired — run `/announce` again.');
    const v = i.fields.getTextInputValue('v');

    switch (i.customId) {
      case 'ann:titleModal': s.title = v; break;
      case 'ann:bodyModal':  s.body = v; break;
      case 'ann:authorModal': s.author = v.trim() || null; break;
      case 'ann:bannerModal': s.banner = v.trim() || null; break;
      case 'ann:colorModal':
        break;
    }

    return i.update({ embeds: [annEmbed(i, s), statusEmbed(i, s)], components: fullPanel(i, s) });
  },
};