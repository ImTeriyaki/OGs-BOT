const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, row, err } = require('./_shared');

const BOOST_PERKS = ['💎 Better audio quality', '📄 More emoji slots', '🎨 Server banner & animated icon', '📎 Bigger upload limits'];

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('📊 Server information'),
  ns: 'si',
  embed(i) {
    const { guild } = i;
    const e = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .setColor(colors.main)
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (Level ${guild.premiumTier})`, inline: true },
      )
      .setFooter({ text: `ID: ${guild.id}` })
      .setTimestamp();
    if (guild.bannerURL()) e.setImage(guild.bannerURL({ size: 1024 }));
    return e;
  },
  buttons(i) {
    return [row(
      new ButtonBuilder().setCustomId('si:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('si:icon').setLabel('🖼️ Icon').setStyle(ButtonStyle.Secondary).setDisabled(!i.guild.iconURL()),
      new ButtonBuilder().setCustomId('si:boosts').setLabel('🚀 Boosts').setStyle(ButtonStyle.Secondary),
    )];
  },
  async run(i) {
    return i.reply({ embeds: [this.embed(i)], components: this.buttons(i) });
  },
  async onButton(i) {
    const action = i.customId.split(':')[1];
    if (action === 'icon') {
      if (!i.guild.iconURL()) return err(i, 'This server has no icon.');
      return i.reply({ embeds: [new EmbedBuilder().setTitle(`${i.guild.name}'s Icon`).setImage(i.guild.iconURL({ size: 1024 })).setColor(colors.main)], ephemeral: true });
    }
    if (action === 'boosts') {
      const { guild } = i;
      return i.reply({
        embeds: [new EmbedBuilder()
          .setTitle('🚀 Server Boosts')
          .setDescription(`**${guild.premiumSubscriptionCount ?? 0}** boosts — **Level ${guild.premiumTier}**`)
          .addFields({ name: 'Perks unlocked', value: BOOST_PERKS.slice(0, guild.premiumTier + 1).join('\n') || '*None yet — boost to unlock perks!*' })
          .setColor(colors.main)],
        ephemeral: true,
      });
    }
    return i.update({ embeds: [this.embed(i)], components: this.buttons(i) });
  },
};
