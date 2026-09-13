const { SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { row, err, textChannels } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder().setName('say').setDescription('💬 Make the bot say something')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(2000)),
  ns: 'sy',
  async run(i) {
    i.client.sayDrafts ??= new Map();
    i.client.sayDrafts.set(i.user.id, i.options.getString('message'));
    const sel = new StringSelectMenuBuilder().setCustomId('sy:channel').setPlaceholder('📺 Pick where to say it…')
      .addOptions(textChannels(i).map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📺', default: c.id === i.channelId })));
    return i.reply({ content: `💬 Message: *${i.options.getString('message').slice(0, 150)}*\nPick the channel:`, components: [row(sel)], ephemeral: true });
  },
  async onSelect(i) {
    const draft = i.client.sayDrafts?.get(i.user.id);
    if (!draft) return err(i, 'Session expired — run `/say` again.');
    const ch = await i.guild.channels.fetch(i.values[0]).catch(() => null);
    if (!ch) return err(i, 'Channel not found.');
    await ch.send(draft).catch(() => {});
    i.client.sayDrafts.delete(i.user.id);
    return i.update({ content: `✅ Sent in ${ch}.`, components: [] });
  },
};
