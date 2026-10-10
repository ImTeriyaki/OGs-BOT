const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, recordAdminAction } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('unlock').setDescription('Unlock this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async run(i, ctx) {
    await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: null });
    recordAdminAction(i, ctx.guild(i.guildId), 'unlock', `${i.channel}`, `#${i.channel.name}`);
    return i.reply({ embeds: [new EmbedBuilder().setTitle('🔓 Channel Unlocked').setDescription('Everyone can send messages again.').setColor(colors.good)] });
  },
};
