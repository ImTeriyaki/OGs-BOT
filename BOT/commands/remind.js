const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { row } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('remind').setDescription('⏰ Set a reminder — duration from a dropdown'),
  ns: 'rmd',
  async run(i) {
    const sel = new StringSelectMenuBuilder().setCustomId('rmd:dur').setPlaceholder('⏰ Remind me in…').addOptions(
      { label: '5 minutes', value: '5', emoji: '⏱️' },
      { label: '30 minutes', value: '30', emoji: '⏱️' },
      { label: '1 hour', value: '60', emoji: '🕐' },
      { label: '6 hours', value: '360', emoji: '🕐' },
      { label: '1 day', value: '1440', emoji: '📅' },
      { label: '1 week', value: '10080', emoji: '📅' },
    );
    return i.reply({ content: '⏰ Pick how long to wait, then write your reminder:', components: [row(sel)], ephemeral: true });
  },
  async onSelect(i) {
    const modal = new ModalBuilder().setCustomId(`rmd:modal:${i.values[0]}`).setTitle('Set Reminder');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('What to remind you about').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)));
    return i.showModal(modal);
  },
  async onModal(i) {
    const minutes = parseInt(i.customId.split(':')[2], 10) || 5;
    const text = i.fields.getTextInputValue('v');
    await i.reply({ content: `⏰ Got it — I'll remind you in **${minutes} min**: *${text}*`, ephemeral: true });
    setTimeout(() => {
      i.user.send(`⏰ **Reminder:** ${text}`).catch(() =>
        i.channel?.send(`⏰ <@${i.user.id}> **Reminder:** ${text}`).catch(() => {}));
    }, minutes * 60 * 1000);
  },
};
