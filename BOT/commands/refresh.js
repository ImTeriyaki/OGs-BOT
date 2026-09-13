const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('🔄 Re-register slash commands instantly (admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async run(i, ctx) {
    await i.guild.commands.set(ctx.commands.map(c => c.data.toJSON()));
    return i.reply({ content: `✅ Registered **${ctx.commands.length}** commands in this server. They appear instantly.`, ephemeral: true });
  },
};
