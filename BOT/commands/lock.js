const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, logAdmin } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('lock').setDescription('Lock this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async run(i) {
    await i.channel.permissionOverwrites.edit(i.guild.id, { SendMessages: false });
    logAdmin(i, 'lock', `#${i.channel.name}`);
    return i.reply({ embeds: [new EmbedBuilder().setTitle('🔒 Channel Locked').setDescription('Only staff can send messages now.').setColor(colors.bad)
      .addFields({ name: 'Unlock', value: 'Use `/unlock` when ready.' })] });
  },
};
