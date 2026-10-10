const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, logAdmin } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('unlock').setDescription('Unlock this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async run(i) {
    await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: null });
    logAdmin(i, 'unlock', `#${i.channel.name}`);
    return i.reply({ embeds: [new EmbedBuilder().setTitle('🔓 Channel Unlocked').setDescription('Everyone can send messages again.').setColor(colors.good)] });
  },
};
