const { SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { row, err, MSG_COLORS } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('rolecreate').setDescription('🏷️ Create a role — color from a dropdown')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true).setMaxLength(100)),
  ns: 'rc',
  async run(i) {
    i.client.rcDrafts ??= new Map();
    i.client.rcDrafts.set(i.user.id, i.options.getString('name'));
    const sel = new StringSelectMenuBuilder().setCustomId('rc:color').setPlaceholder('🎨 Pick a color…')
      .addOptions([...MSG_COLORS, { label: 'Default (Blurple)', hex: '#5865F2' }].map(c => ({ label: c.label, value: c.hex, emoji: '🎨' })));
    return i.reply({ content: `🏷️ Creating role **${i.options.getString('name')}** — pick a color:`, components: [row(sel)], ephemeral: true });
  },
  async onSelect(i) {
    const name = i.client.rcDrafts?.get(i.user.id);
    if (!name) return err(i, 'Session expired — run `/rolecreate` again.');
    const role = await i.guild.roles.create({
      name,
      color: parseInt(i.values[0].replace('#', ''), 16),
      reason: `Created by ${i.user.tag}`,
    }).catch(() => null);
    i.client.rcDrafts?.delete(i.user.id);
    if (!role) return err(i, 'I need **Manage Roles** to create roles.');
    return i.update({ content: `✅ Created ${role}.`, components: [] });
  },
};
