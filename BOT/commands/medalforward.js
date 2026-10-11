const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, row, textChannels } = require('./_shared');

/* ═══════════════════════════ /medalforward ═══════════════════════════
   Any message in any channel containing a medal.tv link gets automatically
   forwarded (via Discord's native "forward" feature) to one admin-set channel.
   No routes, no modes — the destination channel itself is the on/off switch. */

const MEDAL_RE = /https?:\/\/(www\.)?medal\.tv\/\S+/i;

const command = {
  data: new SlashCommandBuilder()
    .setName('medalforward')
    .setDescription('Auto-forward Medal.tv clip links to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'medal',
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const chans = textChannels(i, 24); /* leave room for the "Disable" option — 25 max per select */
    const sel = new StringSelectMenuBuilder().setCustomId('medal:pick').setPlaceholder('🎬 Pick the Medal clips channel…')
      .addOptions(
        { label: 'Disable', value: 'off', emoji: '❌' },
        ...chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🎬', default: c.id === g.medalForwardChannelId })),
      );
    return i.reply({
      embeds: [new EmbedBuilder().setTitle('🎬 Medal.tv Auto-Forward').setColor(colors.main)
        .setDescription(
          'Any message with a medal.tv link, posted in **any channel**, is automatically forwarded here.\n\n'
          + `Current: ${g.medalForwardChannelId ? `<#${g.medalForwardChannelId}>` : '*disabled*'}`,
        )],
      components: [row(sel)],
      ephemeral: true,
    });
  },
  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);
    g.medalForwardChannelId = i.values[0] === 'off' ? null : i.values[0];
    ctx.save();
    return i.update({
      content: g.medalForwardChannelId ? `🎬 Medal clips will be forwarded to <#${g.medalForwardChannelId}>.` : '🎬 Medal auto-forward disabled.',
      components: [],
    });
  },
};

function registerMedalForward(client, ctx) {
  /* message-id dedupe — never forward the same message twice */
  const seen = new Set();

  client.on('messageCreate', async (msg) => {
    try {
      if (!msg.guild || !msg.author || msg.author.bot || msg.webhookId) return;

      const g = ctx.guild(msg.guildId);
      const destId = g.medalForwardChannelId;
      if (!destId || destId === msg.channelId) return;
      if (!MEDAL_RE.test(msg.content ?? '')) return;

      if (seen.has(msg.id)) return;
      seen.add(msg.id);
      if (seen.size > 500) for (const id of seen) { seen.delete(id); if (seen.size <= 250) break; }

      const dest = await msg.guild.channels.fetch(destId).catch(() => null);
      if (!dest?.isTextBased()) return;
      const mePerms = msg.guild.members.me?.permissionsIn(dest);
      if (!mePerms?.has(PermissionFlagsBits.SendMessages)) return;

      await dest.send({
        content: `🎬 <@${msg.author.id}> shared a Medal clip`,
        forward: { message: msg.id, channel: msg.channelId, guild: msg.guildId },
      }).catch(() => {});
    } catch { /* never crash the bot over auto-forward */ }
  });
}

module.exports = { command, registerMedalForward, MEDAL_RE };
