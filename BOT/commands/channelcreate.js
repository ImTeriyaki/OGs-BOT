const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { row, err, menu, categories } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('channelcreate').setDescription('📺 Create a channel — type from buttons')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true).setMaxLength(100)),
  ns: 'cc',
  async run(i) {
    i.client.ccDrafts ??= new Map();
    i.client.ccDrafts.set(i.user.id, i.options.getString('name'));
    i.client.ccType ??= new Map();
    return i.reply({
      content: `📺 Creating **${i.options.getString('name')}** — pick a type and category:`,
      components: [
        row(
          new ButtonBuilder().setCustomId('cc:text').setLabel('Text Channel').setEmoji('💬').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('cc:voice').setLabel('Voice Channel').setEmoji('🔊').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('cc:cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
        ),
        row(menu('cc:cat', '📁 Category (optional)…',
          [{ label: 'No category', value: 'none', emoji: '🚫' },
           ...categories(i).map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁' }))])),
      ],
      ephemeral: true,
    });
  },
  async onButton(i) {
    const name = i.client.ccDrafts?.get(i.user.id);
    if (i.customId.endsWith('cancel')) { i.client.ccDrafts?.delete(i.user.id); return i.update({ content: '✖️ Cancelled.', components: [] }); }
    if (!name) return err(i, 'Session expired — run `/channelcreate` again.');
    const type = i.customId.endsWith('text') ? ChannelType.GuildText : ChannelType.GuildVoice;
    i.client.ccType.set(i.user.id, type);
    /* create immediately with no parent — simpler & works every time */
    const ch = await i.guild.channels.create({
      name: type === ChannelType.GuildVoice ? name : name.toLowerCase().replaceAll(' ', '-'),
      type, reason: `Created by ${i.user.tag}`,
    }).catch(() => null);
    i.client.ccDrafts?.delete(i.user.id);
    if (!ch) return err(i, 'I need **Manage Channels** to create channels.');
    return i.update({ content: `✅ Created ${ch} — drag it into a category anytime.`, components: [] });
  },
};
