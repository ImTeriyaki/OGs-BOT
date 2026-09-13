const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('inrole').setDescription('👥 List members with a role')
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const role = i.options.getRole('role');
    await i.guild.members.fetch().catch(() => {});
    const members = role.members.map(m => `<@${m.id}>`);
    if (!members.length) return i.editReply(`⚠️ Nobody has ${role}.`);
    return i.editReply({
      embeds: [new EmbedBuilder()
        .setTitle(`👥 ${role.name} — ${members.length} member(s)`)
        .setDescription(members.join(', ').slice(0, 4000))
        .setColor(role.color || colors.main)],
    });
  },
};
