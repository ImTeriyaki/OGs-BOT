const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { colors, row, err, voiceChannels } = require('./_shared');

const COUNTER_NAMES = (members) => ({
  total: `👥 Total: ${members.size}`,
  humans: `🧑 Humans: ${members.filter(m => !m.user.bot).size}`,
  bots: `🤖 Bots: ${members.filter(m => m.user.bot).size}`,
  online: `🟢 Online: ${members.filter(m => m.presence && m.presence.status !== 'offline').size}`,
});

module.exports = {
  data: new SlashCommandBuilder().setName('membercount').setDescription('Member count breakdown with live counters'),
  ns: 'mcount',
  embed(i) {
    const members = i.guild.members.cache;
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;
    const online = members.filter(m => m.presence && m.presence.status !== 'offline').size;
    const pct = members.size ? Math.round((online / members.size) * 100) : 0;
    const filled = Math.round(pct / 10);
    return new EmbedBuilder()
      .setTitle(`👥 ${i.guild.name} — Member Count`)
      .setDescription([`**Total:** ${members.size}`, `**Humans:** ${humans}`, `**Bots:** ${bots}`, `**Online:** ${online} (${pct}%)`, `\`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}\` ${pct}%`].join('\n'))
      .setColor(colors.main)
      .setTimestamp();
  },
  async run(i) {
    await i.guild.members.fetch().catch(() => {});
    const canManage = i.member.permissions.has(PermissionFlagsBits.ManageGuild);
    const setupSel = new StringSelectMenuBuilder().setCustomId('mcount:setup').setPlaceholder('⚙️ Live counter setup…')
      .addOptions(
        { label: 'Create live counter channels', value: 'create', emoji: '🆕', description: 'Locked voice channels that auto-update' },
        { label: 'Use an existing channel', value: 'existing', emoji: '📌', description: 'Rename a voice channel you already have' },
        { label: 'Remove live counters', value: 'remove', emoji: '🗑️', description: 'Delete the counter channels' },
      );
    return i.reply({
      embeds: [this.embed(i)],
      components: [
        row(new ButtonBuilder().setCustomId('mcount:refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)),
        ...(canManage ? [row(setupSel)] : []),
      ],
      ephemeral: true,
    });
  },
  async onButton(i) {
    await i.guild.members.fetch().catch(() => {});
    return i.update({ embeds: [this.embed(i)] });
  },
  async onSelect(i, ctx) {
    if (!i.member.permissions.has(PermissionFlagsBits.ManageGuild)) return err(i, 'You need **Manage Server** for setup.');
    const g = ctx.guild(i.guildId);

    if (i.customId === 'mcount:statSel') {
      const stat = i.values[0];
      const chans = voiceChannels(i, 25);
      if (!chans.length) return err(i, 'No voice channels found.');
      const sel = new StringSelectMenuBuilder().setCustomId(`mcount:chanSel:${stat}`).setPlaceholder('📌 Pick the channel to rename…')
        .addOptions(chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🔊' })));
      return i.update({ content: '📌 Pick the voice channel to turn into a live counter:', components: [row(sel)] });
    }
    if (i.customId.startsWith('mcount:chanSel:')) {
      const stat = i.customId.split(':')[2];
      const channel = await i.guild.channels.fetch(i.values[0]).catch(() => null);
      if (!channel) return err(i, "That channel doesn't exist anymore.");
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return err(i, 'I need **Manage Channels**.');
      await i.deferUpdate();
      await i.guild.members.fetch().catch(() => {});
      g.counterIds ??= {};
      g.counterIds[stat] = channel.id;
      ctx.save();
      await channel.setName(COUNTER_NAMES(i.guild.members.cache)[stat]).catch(() => {});
      return i.editReply({ content: `✅ ${channel} will now show the live **${stat}** count — it updates every 2 minutes.` });
    }

    if (i.values[0] === 'remove') {
      if (!g.counterIds) return i.update({ content: '⚠️ No live counters set up.', components: [i.message.components[0]] });
      for (const id of Object.values(g.counterIds)) await i.guild.channels.delete(id).catch(() => {});
      g.counterIds = null;
      ctx.save();
      return i.update({ content: '🗑️ Live counters removed.', components: [i.message.components[0]] });
    }
    if (i.values[0] === 'existing') {
      const sel = new StringSelectMenuBuilder().setCustomId('mcount:statSel').setPlaceholder('📊 Pick what to track…')
        .addOptions(
          { label: 'Total members', value: 'total', emoji: '👥' },
          { label: 'Humans', value: 'humans', emoji: '🧑' },
          { label: 'Bots', value: 'bots', emoji: '🤖' },
          { label: 'Online', value: 'online', emoji: '🟢' },
        );
      return i.update({ content: '📊 Pick which stat this channel should show:', components: [row(sel)] });
    }

    if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return err(i, 'I need **Manage Channels**.');
    await i.deferUpdate();
    await i.guild.members.fetch().catch(() => {});
    const names = COUNTER_NAMES(i.guild.members.cache);
    const ids = {};
    for (const key of Object.keys(names)) {
      const ch = await i.guild.channels.create({
        name: names[key], type: ChannelType.GuildVoice,
        permissionOverwrites: [
          { id: i.guild.id, deny: ['Connect', 'SendMessages'] },
          { id: i.client.user.id, allow: ['Connect', 'ManageChannels'] },
        ],
      }).catch(() => null);
      if (ch) ids[key] = ch.id;
    }
    g.counterIds = ids;
    ctx.save();
    return i.editReply({ content: '✅ Created live counter channels — they update every 2 minutes.\n*If Online stays 0, enable **Server Presence Intent** in the Developer Portal.*' });
  },
};
