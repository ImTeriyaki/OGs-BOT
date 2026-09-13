const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors } = require('./_shared');

function inviteLink(client) {
  return client.generateInvite({
    scopes: ['bot', 'applications.commands'],
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.MoveMembers,
    ],
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('invite').setDescription('🔗 Invite the bot'),
  async run(i) {
    const invite = await inviteLink(i.client);
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🔗 Invite OGs Bot')
        .setDescription(`[Click here to invite me](${invite})`)
        .setColor(colors.main)
        .setThumbnail(i.client.user.displayAvatarURL())],
    });
  },
};
