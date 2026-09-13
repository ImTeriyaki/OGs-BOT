const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, err } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('editsnipe').setDescription('✏️ Last edited message in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async run(i, ctx) {
    const s = ctx.editSnipes.get(i.channel.id);
    if (!s) return err(i, 'Nothing to snipe here.');
    return i.reply({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: s.author, iconURL: s.avatar })
        .addFields(
          { name: 'Before', value: (s.before || '*empty*').slice(0, 1000) },
          { name: 'After', value: (s.after || '*empty*').slice(0, 1000) },
        )
        .setFooter({ text: 'Edited' })
        .setTimestamp(s.at)
        .setColor(colors.warn)],
      ephemeral: true,
    });
  },
};
