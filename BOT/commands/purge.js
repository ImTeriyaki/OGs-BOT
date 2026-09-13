const { SlashCommandBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { row } = require('./_shared');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('🧹 Bulk delete messages — pick the amount from a dropdown')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('user').setDescription('Only delete from this user')),
  ns: 'prg',
  async run(i) {
    await i.deferReply({ ephemeral: true });
    const user = i.options.getUser('user');
    const sel = new StringSelectMenuBuilder().setCustomId('prg:amount').setPlaceholder('🧹 How many messages to delete…')
      .addOptions([5, 10, 25, 50, 100].map(n => ({ label: `Delete ${n} messages`, value: String(n), emoji: '🗑️' })));
    await i.editReply({ content: user ? `🗑️ Deleting from **${user.username}** — pick an amount:` : '🗑️ Pick an amount to delete:', components: [row(sel)] });
    i.client.purgeUsers ??= new Map();
    i.client.purgeUsers.set(i.user.id, user?.id ?? null);
  },
  async onSelect(i) {
    const userId = i.client.purgeUsers?.get(i.user.id) ?? null;
    const amount = parseInt(i.values[0], 10);
    await i.deferUpdate();
    const msgs = await i.channel.messages.fetch({ limit: 100 });
    const target = userId ? [...msgs.values()].filter(m => m.author.id === userId).slice(0, amount) : [...msgs.values()].slice(0, amount);
    await i.channel.bulkDelete(target, true).catch(() => {});
    return i.editReply({ content: `🗑️ Deleted **${target.length}** message(s).`, components: [] });
  },
};
