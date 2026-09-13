const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

/* Only lists commands with NO default_member_permissions requirement — anything gated
   behind ManageGuild/ManageMessages/Administrator/etc. is admin/mod-only and stays hidden
   here automatically, so this never needs manual upkeep as commands are added or changed. */
module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('📖 Show the commands available to you'),
  ns: 'help',
  async run(i, ctx) {
    const lines = ctx.commands
      .filter(c => !c.data.toJSON().default_member_permissions)
      .map(c => `**/${c.data.name}** — ${c.data.description}`)
      .sort((a, b) => a.localeCompare(b));

    const embed = new EmbedBuilder()
      .setTitle('📖 Commands you can use')
      .setDescription(lines.join('\n') || '*No commands available.*')
      .setColor(colors.main)
      .setFooter({ text: `${lines.length} commands • ask a server admin about anything else` });

    return i.reply({ embeds: [embed], ephemeral: true });
  },
};
