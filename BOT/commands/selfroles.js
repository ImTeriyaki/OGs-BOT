const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row, err, rolesMenu } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('selfroles')
    .setDescription('🎫 Roles members can give themselves — multi-select admin panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  ns: 'srole',
  buildMenu(i, g) {
    g.selfroles ??= [];
    return new StringSelectMenuBuilder().setCustomId('srole:manage').setPlaceholder('🎫 Select available selfroles…')
      .setMinValues(0).setMaxValues(25)
      .addOptions(rolesMenu(i).map(r => ({ ...r, default: g.selfroles.includes(r.value) })));
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    g.selfroles ??= [];
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('🎫 Selfroles — Admin Panel').setColor(colors.main)
        .setDescription(`Roles members can pick:\n${g.selfroles.map(r => `<@&${r}>`).join(' ') || '*none — select below*'}\n\n✅ Saves instantly. Members use the public panel posted with the button below.`)],
      components: [row(this.buildMenu(i, g)), row(new ButtonBuilder().setCustomId('srole:post').setLabel('Post Public Panel').setEmoji('📌').setStyle(ButtonStyle.Success))],
      ephemeral: true,
    });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    g.selfroles ??= [];
    if (!g.selfroles.length) return err(i, 'Select at least one selfrole first.');
    const menu = new StringSelectMenuBuilder().setCustomId('srole:pick').setPlaceholder('🎫 Choose your roles…')
      .setMinValues(0).setMaxValues(g.selfroles.length)
      .addOptions(g.selfroles.map(r => ({ label: (i.guild.roles.cache.get(r)?.name ?? r).slice(0, 100), value: r, emoji: '🎫' })));
    await i.channel.send({
      embeds: [new EmbedBuilder().setTitle('🎫 Pick Your Roles').setColor(colors.main)
        .setDescription('Select your roles from the menu below.\n**Available:** ' + g.selfroles.map(r => `<@&${r}>`).join(' '))],
      components: [row(menu)],
    });
    return i.reply({ content: '✅ Public panel posted.', ephemeral: true });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    if (i.customId === 'srole:manage') {
      g.selfroles = i.values;
      ctx.save();
      return i.update({
        embeds: [new EmbedBuilder().setTitle('🎫 Selfroles — Admin Panel').setColor(colors.good)
          .setDescription(`✅ Saved. Members can pick:\n${g.selfroles.map(r => `<@&${r}>`).join(' ') || '*none*'}`)],
        components: [row(this.buildMenu(i, g)), row(new ButtonBuilder().setCustomId('srole:post').setLabel('Post Public Panel').setEmoji('📌').setStyle(ButtonStyle.Success))],
      });
    }
    if (i.customId === 'srole:pick') {
      g.selfroles ??= [];
      await i.member.roles.remove(g.selfroles.filter(r => !i.values.includes(r))).catch(() => {});
      await i.member.roles.add(i.values).catch(() => {});
      return i.update({ content: `✅ Your roles: ${i.values.map(r => `<@&${r}>`).join(' ') || '*none*'}`, components: [i.message.components[0]] });
    }
  },
};
