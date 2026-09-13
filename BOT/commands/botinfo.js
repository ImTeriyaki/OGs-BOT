const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ActivityType,
} = require('discord.js');
const { colors, row, err, menu, formatDuration } = require('./_shared');

/* bot presence/activity is global — set here, it changes what every server sees,
   not just the one this command was run in. Not persisted: resets on restart. */
const ACTIVITY_TYPES = {
  playing: { label: 'Playing', type: ActivityType.Playing, emoji: '🎮' },
  watching: { label: 'Watching', type: ActivityType.Watching, emoji: '👀' },
  listening: { label: 'Listening to', type: ActivityType.Listening, emoji: '🎧' },
  competing: { label: 'Competing in', type: ActivityType.Competing, emoji: '🏆' },
  custom: { label: 'Custom Status', type: ActivityType.Custom, emoji: '💬' },
};

function requireAdmin(i) {
  if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    err(i, 'You need **Manage Server** to change the bot status.');
    return false;
  }
  return true;
}

module.exports = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription('🤖 Bot information'),
  ns: 'bi',
  embed(i, ctx) {
    return new EmbedBuilder()
      .setTitle('🤖 OGs Bot')
      .setThumbnail(i.client.user.displayAvatarURL({ size: 512 }))
      .setColor(colors.main)
      .addFields(
        { name: '📡 Ping', value: `${Math.round(i.client.ws.ping)}ms`, inline: true },
        { name: '⏱️ Uptime', value: formatDuration(i.client.uptime), inline: true },
        { name: '🏢 Servers', value: `${i.client.guilds.cache.size}`, inline: true },
        { name: '👥 Users', value: `${i.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`, inline: true },
        { name: '⚙️ Commands', value: `${ctx.commands.length}`, inline: true },
        { name: '🧠 discord.js', value: require('discord.js').version, inline: true },
      );
  },
  async run(i, ctx) {
    return i.reply({
      embeds: [this.embed(i, ctx)],
      components: [row(new ButtonBuilder().setCustomId('bi:status').setLabel('🎭 Set Bot Status').setStyle(ButtonStyle.Secondary))],
    });
  },
  async onButton(i) {
    if (i.customId !== 'bi:status') return;
    if (!requireAdmin(i)) return;
    return i.reply({
      content: '🎭 Set the bot\'s presence, pick an activity type to set custom text, or clear the status entirely:',
      components: [
        row(menu('bi:presence', '🟢 Pick a presence…', [
          { label: 'Online', value: 'online', emoji: '🟢' },
          { label: 'Idle', value: 'idle', emoji: '🌙' },
          { label: 'Do Not Disturb', value: 'dnd', emoji: '⛔' },
          { label: 'Invisible', value: 'invisible', emoji: '⚫' },
        ])),
        row(menu('bi:activity', '🎭 Pick an activity type…', [
          ...Object.entries(ACTIVITY_TYPES).map(([k, v]) => ({ label: v.label, value: k, emoji: v.emoji })),
          { label: 'Clear status', value: 'clear', emoji: '🧹' },
        ])),
      ],
      ephemeral: true,
    });
  },
  async onSelect(i) {
    if (i.customId === 'bi:presence') {
      if (!requireAdmin(i)) return;
      i.client.user.setStatus(i.values[0]);
      return i.update({ content: `🟢 Presence set to **${i.values[0]}**.`, components: [] });
    }
    if (i.customId === 'bi:activity') {
      if (!requireAdmin(i)) return;
      if (i.values[0] === 'clear') {
        i.client.user.setActivity(null);
        return i.update({ content: '🧹 Status cleared.', components: [] });
      }
      const modal = new ModalBuilder().setCustomId(`bi:activityModal:${i.values[0]}`).setTitle('Set Status Text');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Status text')
        .setStyle(TextInputStyle.Short).setMaxLength(128).setRequired(true)));
      return i.showModal(modal);
    }
  },
  async onModal(i) {
    if (!i.customId.startsWith('bi:activityModal:')) return;
    if (!requireAdmin(i)) return;
    const kind = i.customId.split(':')[2];
    const meta = ACTIVITY_TYPES[kind];
    if (!meta) return err(i, 'Unknown activity type.');
    const text = i.fields.getTextInputValue('v').trim();
    i.client.user.setActivity(text, { type: meta.type });
    return i.reply({ content: `✅ Status set to **${meta.label} ${text}**.`, ephemeral: true });
  },
};
