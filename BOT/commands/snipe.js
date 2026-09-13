const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, err } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('snipe').setDescription('🎯 Last deleted message in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async run(i, ctx) {
    const s = ctx.snipes.get(i.channel.id);
    if (!s) return err(i, 'Nothing to snipe here.');
    return i.reply({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: s.author, iconURL: s.avatar })
        .setDescription(s.content || '*no text*')
        .setImage(s.image)
        .setFooter({ text: 'Deleted' })
        .setTimestamp(s.at)
        .setColor(colors.main)],
      ephemeral: true,
    });
  },
};
