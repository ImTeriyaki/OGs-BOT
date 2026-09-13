const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { colors } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('avatar').setDescription("🖼️ Show a user's avatar")
    .addUserOption(o => o.setName('user').setDescription('User')),
  async run(i) {
    const user = i.options.getUser('user') ?? i.user;
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 1024 }))
        .setColor(colors.main)
        .addFields({
          name: 'Links',
          value: `[PNG](${user.displayAvatarURL({ extension: 'png', size: 1024 })}) • [JPG](${user.displayAvatarURL({ extension: 'jpg', size: 1024 })}) • [WEBP](${user.displayAvatarURL({ extension: 'webp', size: 1024 })})`,
        })],
    });
  },
};
