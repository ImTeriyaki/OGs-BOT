const { SlashCommandBuilder } = require('discord.js');
const { formatDuration } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('uptime').setDescription('⏱️ Bot uptime'),
  async run(i) {
    return i.reply({ content: `⏱️ Online for **${formatDuration(i.client.uptime)}**`, ephemeral: true });
  },
};
