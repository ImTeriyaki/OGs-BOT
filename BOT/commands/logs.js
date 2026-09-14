const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row, textChannels } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('📜 Set the error log channel — dropdown picker')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'logs',
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const chans = textChannels(i, 24); /* leave room for the "Disable" option — 25 max per select */
    const sel = new StringSelectMenuBuilder().setCustomId('logs:pick').setPlaceholder('📜 Pick the error log channel…')
      .addOptions(
        { label: 'Disable error logging', value: 'off', emoji: '❌' },
        ...chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜', default: c.id === g.logsChannelId })),
      );
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('📜 Error Logs').setColor(colors.main)
        .setDescription(`Current: ${g.logsChannelId ? `<#${g.logsChannelId}>` : '*disabled*'}\n\nErrors will appear with codes like \`ERR-7F3A2B\`.`)],
      components: [row(sel)],
      ephemeral: true,
    });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    g.logsChannelId = i.values[0] === 'off' ? null : i.values[0];
    ctx.save();
    return i.update({ content: g.logsChannelId ? `📜 Errors will be logged in <#${g.logsChannelId}>.` : '📜 Error logging disabled.', components: [] });
  },
};
