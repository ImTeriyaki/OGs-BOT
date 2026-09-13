const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { colors, row, err } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('channelinfo').setDescription('📺 Channel information — includes lock/unlock/delete controls')
    .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  ns: 'ci',
  async run(i) {
    const channel = i.options.getChannel('channel') ?? i.channel;
    const embed = new EmbedBuilder()
      .setTitle(`📺 #${channel.name}`)
      .setColor(colors.main)
      .addFields(
        { name: '🆔 ID', value: channel.id, inline: true },
        { name: '📂 Type', value: channel.type === ChannelType.GuildVoice ? 'Voice' : 'Text', inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '🐢 Slowmode', value: channel.rateLimitPerUser ? `${channel.rateLimitPerUser}s` : 'Off', inline: true },
      );
    if (channel.parent) embed.addFields({ name: '📁 Category', value: channel.parent.name, inline: true });
    if (channel.topic) embed.addFields({ name: '📝 Topic', value: channel.topic.slice(0, 1024) });
    const actions = row(
      new ButtonBuilder().setCustomId(`ci:lock:${channel.id}`).setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ci:unlock:${channel.id}`).setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ci:delete:${channel.id}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    );
    return i.reply({ embeds: [embed], components: [actions] });
  },
  async onButton(i) {
    if (!i.member.permissions.has(PermissionFlagsBits.ManageChannels)) return err(i, 'You need **Manage Channels** for that.');
    const [, action, id] = i.customId.split(':');
    const ch = await i.guild.channels.fetch(id).catch(() => null);
    if (!ch) return err(i, 'Channel not found.');
    if (action === 'lock') { await ch.permissionOverwrites.edit(i.guild.id, { SendMessages: false }); return i.reply({ content: `🔒 Locked ${ch}.`, ephemeral: true }); }
    if (action === 'unlock') { await ch.permissionOverwrites.edit(i.guild.id, { SendMessages: null }); return i.reply({ content: `🔓 Unlocked ${ch}.`, ephemeral: true }); }
    if (action === 'delete') {
      return i.reply({
        content: `⚠️ Delete ${ch}? This cannot be undone.`,
        components: [row(
          new ButtonBuilder().setCustomId(`ci:delConfirm:${id}`).setLabel('✅ Delete Channel').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('ci:delCancel').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
        )],
        ephemeral: true,
      });
    }
    if (action === 'delCancel') return i.update({ content: '✖️ Cancelled.', components: [] });
    if (action === 'delConfirm') {
      await ch.delete(`[by ${i.user.tag}]`).catch(() => {});
      return i.update({ content: '🗑️ Channel deleted.', components: [] });
    }
  },
};
