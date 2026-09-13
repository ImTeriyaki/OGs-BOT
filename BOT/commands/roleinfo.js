const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('roleinfo').setDescription('🎭 Role information')
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)),
  async run(i) {
    const role = i.options.getRole('role');
    await i.guild.members.fetch().catch(() => {});
    const pct = Math.min(100, Math.round((role.members.size / Math.max(1, i.guild.memberCount)) * 100));
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`🎭 ${role.name}`)
        .setColor(role.color || colors.main)
        .setThumbnail(i.guild.iconURL({ size: 128 }))
        .addFields(
          { name: '🆔 ID', value: role.id, inline: true },
          { name: '🎨 Color', value: role.hexColor, inline: true },
          { name: '👥 Members', value: `${role.members.size} (${pct}% of server)`, inline: true },
          { name: '📍 Position', value: `${role.position}`, inline: true },
          { name: '📌 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: '🤖 Managed', value: role.managed ? 'Yes' : 'No', inline: true },
          { name: 'Coverage', value: `\`${'█'.repeat(Math.round(pct / 10)).padEnd(10, '░')}\` ${pct}%` },
        )],
    });
  },
};
