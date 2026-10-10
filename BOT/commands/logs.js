const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row, textChannels, readAdminLog } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Set the error log channel — dropdown picker')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'logs',
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const chans = textChannels(i, 24); /* leave room for the "Disable" option — 25 max per select */
    const errSel = new StringSelectMenuBuilder().setCustomId('logs:pick').setPlaceholder('📜 Pick the error log channel…')
      .addOptions(
        { label: 'Disable error logging', value: 'off', emoji: '❌' },
        ...chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜', default: c.id === g.logsChannelId })),
      );
    const modSel = new StringSelectMenuBuilder().setCustomId('logs:modPick').setPlaceholder('🛡️ Pick the mod action log channel…')
      .addOptions(
        { label: 'Disable mod action logging', value: 'off', emoji: '❌' },
        ...chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🛡️', default: c.id === g.modLogChannelId })),
      );
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('📜 Logs').setColor(colors.main)
        .setDescription([
          `**Error log:** ${g.logsChannelId ? `<#${g.logsChannelId}>` : '*disabled*'} — errors appear with codes like \`ERR-7F3A2B\`.`,
          `**Mod action log:** ${g.modLogChannelId ? `<#${g.modLogChannelId}>` : '*disabled*'} — styled embeds for ban/kick/mute/timeout/warn/etc.`,
        ].join('\n'))],
      components: [
        row(errSel),
        row(modSel),
        row(
          new ButtonBuilder().setCustomId('logs:view').setLabel('🖨️ View Admin Log').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('logs:download').setLabel('📄 Download Admin Log').setStyle(ButtonStyle.Secondary),
        ),
      ],
      ephemeral: true,
    });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    if (i.customId === 'logs:modPick') {
      g.modLogChannelId = i.values[0] === 'off' ? null : i.values[0];
      ctx.save();
      return i.update({ content: g.modLogChannelId ? `🛡️ Mod actions will be logged in <#${g.modLogChannelId}>.` : '🛡️ Mod action logging disabled.', components: [] });
    }
    g.logsChannelId = i.values[0] === 'off' ? null : i.values[0];
    ctx.save();
    return i.update({ content: g.logsChannelId ? `📜 Errors will be logged in <#${g.logsChannelId}>.` : '📜 Error logging disabled.', components: [] });
  },
  async onButton(i) {
    const action = i.customId.split(':')[1];
    const lines = readAdminLog(i.guildId);
    if (!lines.length) return i.reply({ content: '📭 No admin actions logged yet.', ephemeral: true });

    if (action === 'view') {
      const recent = lines.slice(-15).join('\n').slice(-1900);
      return i.reply({ content: `🖨️ **Last ${Math.min(15, lines.length)} admin action(s):**\n\`\`\`\n${recent}\n\`\`\``, ephemeral: true });
    }
    if (action === 'download') {
      const file = new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `admin-log-${i.guildId}.txt` });
      return i.reply({ content: `📄 ${lines.length} logged admin action(s).`, files: [file], ephemeral: true });
    }
  },
};
