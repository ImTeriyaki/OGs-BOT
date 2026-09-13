const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row, rolesMenu } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('🏷️ Roles automatically given when members join — multi-select')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  ns: 'arole',
  buildMenu(i, g) {
    g.autoroles ??= [];
    return new StringSelectMenuBuilder().setCustomId('arole:pick').setPlaceholder('🏷️ Select autoroles (multiple allowed)…')
      .setMinValues(0).setMaxValues(25)
      .addOptions(rolesMenu(i).map(r => ({ ...r, default: g.autoroles.includes(r.value) })));
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    g.autoroles ??= [];
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('🏷️ Autoroles').setColor(colors.main)
        .setDescription(`Roles given automatically on join:\n${g.autoroles.map(r => `<@&${r}>`).join(' ') || '*none — select from the dropdown*\n\n✅ Selections save instantly — whatever is highlighted in the menu is active.'}`)],
      components: [row(this.buildMenu(i, g))],
      ephemeral: true,
    });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    g.autoroles = i.values;
    ctx.save();
    return i.update({
      embeds: [new EmbedBuilder().setTitle('🏷️ Autoroles').setColor(colors.good)
        .setDescription(`✅ Saved — roles given on join:\n${g.autoroles.map(r => `<@&${r}>`).join(' ') || '*none*'}`)],
      components: [row(this.buildMenu(i, g))],
    });
  },
};
