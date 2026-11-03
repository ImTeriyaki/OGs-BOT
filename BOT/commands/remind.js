const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { row } = require('./_shared');

const MAX_SECONDS = 2073600; // 24 days — setTimeout overflows past ~24.8 days (2^31-1 ms)

/* accepts a bare number (seconds) or "<n><unit>", e.g. "90", "90s", "45m", "2h", "3d" */
function parseCustomDuration(str) {
  const match = str.trim().match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (n <= 0) return null;
  const unit = (match[2] || 's')[0].toLowerCase();
  const seconds = unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : unit === 'd' ? n * 86400 : n;
  return seconds > MAX_SECONDS ? null : seconds;
}

function formatLabel(seconds) {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)} day(s)`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)} hr`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds} sec`;
}

module.exports = {
  data: new SlashCommandBuilder().setName('remind').setDescription('Set a reminder — duration from a dropdown'),
  ns: 'rmd',
  async run(i) {
    const sel = new StringSelectMenuBuilder().setCustomId('rmd:dur').setPlaceholder('⏰ Remind me in…').addOptions(
      { label: '5 minutes', value: '300', emoji: '⏱️' },
      { label: '10 minutes', value: '600', emoji: '⏱️' },
      { label: '30 minutes', value: '1800', emoji: '⏱️' },
      { label: '1 hour', value: '3600', emoji: '🕐' },
      { label: 'Custom…', value: 'custom', emoji: '✏️' },
    );
    return i.reply({ content: '⏰ Pick how long to wait, then write your reminder:', components: [row(sel)], ephemeral: true });
  },
  async onSelect(i) {
    const modal = new ModalBuilder().setCustomId(`rmd:modal:${i.values[0]}`).setTitle('Set Reminder');
    if (i.values[0] === 'custom') {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('dur').setLabel('Remind me in… (e.g. 30s, 45m, 2h, 3d)').setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(true)));
    }
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('What to remind you about').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)));
    return i.showModal(modal);
  },
  async onModal(i) {
    const key = i.customId.split(':')[2];
    const text = i.fields.getTextInputValue('v');
    let seconds;
    if (key === 'custom') {
      seconds = parseCustomDuration(i.fields.getTextInputValue('dur'));
      if (!seconds) {
        return i.reply({ content: `⚠️ That duration didn't make sense. Try something like \`30s\`, \`45m\`, \`2h\`, or \`3d\` (max ${Math.floor(MAX_SECONDS / 86400)} days).`, ephemeral: true });
      }
    } else {
      seconds = parseInt(key, 10) || 300;
    }
    await i.reply({ content: `⏰ Got it — I'll remind you in **${formatLabel(seconds)}**: *${text}*`, ephemeral: true });
    setTimeout(() => {
      i.user.send(`⏰ **Reminder:** ${text}`).catch(() =>
        i.channel?.send(`⏰ <@${i.user.id}> **Reminder:** ${text}`).catch(() => {}));
    }, seconds * 1000);
  },
};
