const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('userinfo').setDescription('👤 User information')
    .addUserOption(o => o.setName('user').setDescription('User to inspect')),
  async run(i, ctx) {
    const user = i.options.getUser('user') ?? i.user;
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const g = ctx.guild(i.guildId);
    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Info`)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .setColor(member?.displayColor || colors.main)
      .addFields(
        { name: '🏷️ Username', value: user.username, inline: true },
        { name: '🆔 ID', value: user.id, inline: true },
        { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: '📅 Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      );
    if (member) {
      embed.addFields(
        { name: '📥 Joined server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: '🎭 Roles', value: member.roles.cache.filter(r => r.id !== i.guild.id).map(r => `<@&${r.id}>`).join(' ').slice(0, 1024) || '*none*', inline: false },
        { name: '⚠️ Warnings', value: `${(g.warns?.[user.id] ?? []).length}`, inline: true },
        { name: '🔇 Timed out', value: member.isCommunicationDisabled() ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>` : 'No', inline: true },
      );
    }
    return i.reply({ embeds: [embed] });
  },
};
