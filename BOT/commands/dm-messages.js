const { EmbedBuilder } = require('discord.js');

/* ═══════════════════ welcome DM engine (guildMemberAdd listener) ═══════════════════ */
/* Sends the configured welcome message as a DM when the "DM Greeting"
   toggle is enabled in /welcome. DM only — never posts anywhere else. */
function registerDmMessages(client, ctx) {
  client.on('guildMemberAdd', async (member) => {
    try {
      if (member.user.bot) return;
      const g = ctx.guild(member.guild.id);
      const w = g?.welcome;
      if (!w?.enabled || !w.dmUser) return;

      const text = (w.dmMessage ?? w.message ?? 'Welcome to {server}!')
        .replaceAll('{user}', `<@${member.id}>`)
        .replaceAll('{username}', member.user.username)
        .replaceAll('{server}', member.guild.name)
        .replaceAll('{membercount}', String(member.guild.memberCount));

      const embed = new EmbedBuilder()
        .setTitle(w.title ?? '👋 Welcome!')
        .setDescription(text)
        .setColor(w.color ? parseInt(w.color.replace('#', ''), 16) : 0x5865F2)
        .setThumbnail(w.pfp ?? member.user.displayAvatarURL())
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();
      if (w.banner) embed.setImage(w.banner);

      await member.send({ embeds: [embed] }).catch(() => {});
    } catch { /* never crash over a DM */ }
  });
}

module.exports = { registerDmMessages };
