const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err } = require('./_shared');

const INVITE_RE = /^https?:\/\/\S+$/i;

function inviteEmbed(g) {
  return new EmbedBuilder()
    .setTitle('🔗 Server Invite')
    .setDescription(g.inviteLink ? g.inviteLink : '*No invite link has been set yet.*')
    .setColor(colors.main);
}
const inviteButtons = () => [row(new ButtonBuilder().setCustomId('si:inviteSet').setLabel('✏️ Set Invite Link').setStyle(ButtonStyle.Secondary))];

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('📊 Server information'),
  ns: 'si',
  embed(i) {
    const { guild } = i;
    const online = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
    const e = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .setColor(colors.main)
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '🟢 Online', value: `${online}`, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (Level ${guild.premiumTier})`, inline: true },
      )
      .setFooter({ text: `ID: ${guild.id}` })
      .setTimestamp();
    if (guild.bannerURL()) e.setImage(guild.bannerURL({ size: 1024 }));
    return e;
  },
  buttons() {
    return [row(
      new ButtonBuilder().setCustomId('si:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('si:invite').setLabel('🔗 Invite').setStyle(ButtonStyle.Success),
    )];
  },
  async run(i) {
    return i.reply({ embeds: [this.embed(i)], components: this.buttons(i), ephemeral: true });
  },
  async onButton(i, ctx) {
    const action = i.customId.split(':')[1];
    if (action === 'invite') {
      const g = ctx.guild(i.guildId);
      const canManage = i.member.permissions.has(PermissionFlagsBits.ManageGuild);
      return i.reply({ embeds: [inviteEmbed(g)], components: canManage ? inviteButtons() : [], ephemeral: true });
    }
    if (action === 'inviteSet') {
      if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** to set this.');
      const g = ctx.guild(i.guildId);
      const modal = new ModalBuilder().setCustomId('si:inviteModal').setTitle('Set Invite Link');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Invite link (any URL)')
        .setStyle(TextInputStyle.Short).setMaxLength(200).setValue(g.inviteLink ?? '')
        .setPlaceholder('https://discord.gg/yourcode').setRequired(true)));
      return i.showModal(modal);
    }
    return i.update({ embeds: [this.embed(i)], components: this.buttons(i) });
  },
  async onModal(i, ctx) {
    if (i.customId !== 'si:inviteModal') return;
    if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** to set this.');
    const g = ctx.guild(i.guildId);
    const link = i.fields.getTextInputValue('v').trim();
    if (!INVITE_RE.test(link)) return err(i, 'That doesn\'t look like a valid link — it must start with `http://` or `https://`.');
    g.inviteLink = link;
    ctx.save();
    return i.update({ embeds: [inviteEmbed(g)], components: inviteButtons() });
  },
};
