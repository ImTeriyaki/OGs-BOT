const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err } = require('./_shared');

const INVITE_RE = /^https?:\/\/(www\.)?(discord\.gg|discord(app)?\.com\/invite)\/\S+$/i;

module.exports = {
  data: new SlashCommandBuilder().setName('serverinvite').setDescription('🔗 Get an invite link to this server'),
  ns: 'sinv',
  embed(g) {
    return new EmbedBuilder()
      .setTitle('🔗 Server Invite')
      .setDescription(g.inviteLink ? g.inviteLink : '*No invite link has been set yet.*')
      .setColor(colors.main);
  },
  buttons() {
    return [row(new ButtonBuilder().setCustomId('sinv:set').setLabel('✏️ Set Invite Link').setStyle(ButtonStyle.Secondary))];
  },
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    return i.reply({ embeds: [this.embed(g)], components: this.buttons() });
  },
  async onButton(i, ctx) {
    if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** to set this.');
    const g = ctx.guild(i.guildId);
    const modal = new ModalBuilder().setCustomId('sinv:modal').setTitle('Set Invite Link');
    modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Discord invite link')
      .setStyle(TextInputStyle.Short).setMaxLength(200).setValue(g.inviteLink ?? '')
      .setPlaceholder('https://discord.gg/yourcode').setRequired(true)));
    return i.showModal(modal);
  },
  async onModal(i, ctx) {
    const g = ctx.guild(i.guildId);
    const link = i.fields.getTextInputValue('v').trim();
    if (!INVITE_RE.test(link)) return err(i, "That doesn't look like a valid Discord invite link — expected something like `https://discord.gg/yourcode`.");
    g.inviteLink = link;
    ctx.save();
    return i.reply({ embeds: [this.embed(g)], components: this.buttons() });
  },
};
