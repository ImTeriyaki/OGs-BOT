const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { colors, row, err, menu, categories } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Post a support ticket panel — dropdown setup')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'tkt',
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('🎫 Ticket Setup').setColor(colors.main)
        .setDescription(`**Ticket category:** pick below\n**Current:** ${g.ticketCategoryId ? `<#${g.ticketCategoryId}>` : '*not set*'}`)],
      components: [
        row(menu('tkt:cat', '📁 Category tickets open in…',
          categories(i).map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁', default: c.id === g.ticketCategoryId })))),
        row(new ButtonBuilder().setCustomId('tkt:post').setLabel('Post Panel').setEmoji('📌').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('tkt:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Secondary)),
      ],
      ephemeral: true,
    });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    if (i.customId === 'tkt:cat') { g.ticketCategoryId = i.values[0]; ctx.save(); }
    return i.update({ content: `📁 Tickets will open in **${i.guild.channels.cache.get(i.values[0])?.name}**.` });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const action = i.customId.split(':')[1];

    /* ticket channel close buttons (inside a ticket channel) */
    if (action === 'close' && i.channel?.topic?.startsWith('ticket:')) {
      return i.reply({
        content: '⚠️ Close this ticket?',
        components: [row(
          new ButtonBuilder().setCustomId('tkt:closeConfirm').setLabel('✅ Confirm Close').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('tkt:closeCancel').setLabel('✖ Cancel').setStyle(ButtonStyle.Secondary),
        )],
        ephemeral: true,
      });
    }
    if (action === 'closeCancel') return i.update({ content: 'Ticket stays open.', components: [] });
    if (action === 'closeConfirm') {
      await i.update({ content: '🔒 Closing…', components: [] });
      return setTimeout(() => i.channel?.delete().catch(() => {}), 3000);
    }

    /* setup panel buttons */
    if (action === 'post') {
      const panel = await i.channel.send({
        embeds: [new EmbedBuilder().setTitle('🎫 Support Tickets').setColor(colors.main)
          .setDescription('Need help? Click the button below to open a private ticket with the staff team.')],
        components: [row(new ButtonBuilder().setCustomId('tkt:open').setLabel('🎫 Open a Ticket').setStyle(ButtonStyle.Primary))],
      }).catch(() => null);
      if (!panel) return err(i, "I couldn't post the panel here.");
      return i.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
    }
    if (action === 'close') { await i.message.delete().catch(() => {}); return i.reply({ content: '✖️ Closed.', ephemeral: true }).catch(() => {}); }

    if (action === 'open') {
      const existing = i.guild.channels.cache.find(c => c.topic === `ticket:${i.user.id}`);
      if (existing) return err(i, `You already have a ticket: ${existing}`);
      const ch = await i.guild.channels.create({
        name: `🎫-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: g.ticketCategoryId ?? null,
        topic: `ticket:${i.user.id}`,
        permissionOverwrites: [
          { id: i.guild.id, deny: ['ViewChannel'] },
          { id: i.user.id, allow: ['ViewChannel', 'SendMessages'] },
        ],
      }).catch(() => null);
      if (!ch) return err(i, 'I need **Manage Channels** to open tickets.');
      await ch.send({
        content: `${i.user} — describe your issue and staff will be with you shortly.`,
        components: [row(new ButtonBuilder().setCustomId('tkt:close').setLabel('🔒 Close').setStyle(ButtonStyle.Danger))],
      });
      return i.reply({ content: `✅ Your ticket: ${ch}`, ephemeral: true });
    }
  },
};
