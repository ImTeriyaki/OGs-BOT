const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, logAdmin } = require('./_shared');

/* ═══════════════════════════ /verify — captcha gate ═══════════════════════════
   /verify posts a panel; clicking it opens a modal showing a short code to type
   back — a plain, no-image, no-dependency captcha (the modal label IS the
   challenge). Correct code -> the configured role (set via /setup). Codes live
   in memory only, single-use, 5-minute expiry. Every attempt — started, failed,
   or succeeded — is optionally logged to g.verifyLogChannelId (set via /setup). */

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to misread
const pending = new Map(); // `${guildId}:${userId}` -> { code, expiresAt }

function genCode(len = 6) {
  let out = '';
  for (let x = 0; x < len; x++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

const VERIFY_LOG_TITLES = {
  initialized: 'A Verification Process Has Been Initialized',
  failed: 'A Verification Has Failed',
  succeeded: 'A Verification Has Succeeded',
};
const VERIFY_LOG_COLORS = { initialized: colors.warn, failed: colors.bad, succeeded: colors.good };

function verifyLogEmbed(member, status, reason) {
  const created = Math.floor(member.user.createdTimestamp / 1000);
  const joined = Math.floor(member.joinedTimestamp / 1000);
  const embed = new EmbedBuilder()
    .setTitle(VERIFY_LOG_TITLES[status])
    .addFields(
      { name: 'User name', value: `[${member.user.tag}](https://discord.com/users/${member.id})` },
      { name: 'ID', value: `${member.id} (<@${member.id}>)` },
      { name: 'Account creation', value: `<t:${created}:D> (<t:${created}:R>)`, inline: true },
      { name: 'Joined server', value: `<t:${joined}:D> (<t:${joined}:R>)`, inline: true },
    )
    .setColor(VERIFY_LOG_COLORS[status])
    .setTimestamp();
  if (reason) embed.addFields({ name: 'Reason', value: reason, inline: true });
  return embed;
}

async function postVerifyLog(guild, g, status, member, reason) {
  if (!g.verifyLogChannelId) return;
  const ch = await guild.channels.fetch(g.verifyLogChannelId).catch(() => null);
  if (!ch) return;
  await ch.send({ embeds: [verifyLogEmbed(member, status, reason)] }).catch(() => {});
}

/* records every verification attempt both to the optional log channel (embed, see
   screenshot this mirrors) and to the plain-text admin log file so it shows up in
   /logs' View/Download buttons alongside other admin-visible activity. */
async function logVerify(i, g, status, reason) {
  await postVerifyLog(i.guild, g, status, i.member, reason);
  logAdmin(i, `verify-${status}`, `${i.user.tag} (${i.user.id})${reason ? ` — ${reason}` : ''}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Post a verification panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'vrf',
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    if (!g.verifyRoleId) return err(i, 'No verified role is configured — set one via `/setup` first.');
    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Verification Required')
        .setDescription('Click the button below and complete a quick captcha to get verified and gain access to the server.')
        .setColor(colors.main)],
      components: [row(new ButtonBuilder().setCustomId('vrf:start').setLabel('✅ Verify').setStyle(ButtonStyle.Success))],
    });
  },
  async onButton(i, ctx) {
    if (i.customId !== 'vrf:start') return;
    const g = ctx.guild(i.guildId);
    if (!g.verifyRoleId) return err(i, 'No verified role is configured — ask an admin to run `/setup`.');
    if (i.member.roles.cache.has(g.verifyRoleId)) return i.reply({ content: "✅ You're already verified!", ephemeral: true });

    const code = genCode();
    pending.set(`${i.guildId}:${i.user.id}`, { code, expiresAt: Date.now() + 5 * 60_000 });
    await logVerify(i, g, 'initialized');
    const modal = new ModalBuilder().setCustomId('vrf:modal').setTitle('Complete Verification');
    modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel(`Type this code: ${code}`)
      .setStyle(TextInputStyle.Short).setMaxLength(10).setRequired(true)));
    return i.showModal(modal);
  },
  async onModal(i, ctx) {
    if (i.customId !== 'vrf:modal') return;
    const g = ctx.guild(i.guildId);
    const key = `${i.guildId}:${i.user.id}`;
    const entry = pending.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      pending.delete(key);
      await logVerify(i, g, 'failed', 'timed_out');
      return err(i, 'That code expired — click **Verify** again to get a new one.');
    }
    if (i.fields.getTextInputValue('v').trim().toUpperCase() !== entry.code) {
      await logVerify(i, g, 'failed', 'incorrect_code');
      return err(i, "That code doesn't match — click **Verify** again to get a new one.");
    }
    pending.delete(key);

    const role = g.verifyRoleId ? await i.guild.roles.fetch(g.verifyRoleId).catch(() => null) : null;
    if (!role) {
      await logVerify(i, g, 'failed', 'role_missing');
      return err(i, 'The verified role no longer exists — ask an admin to reconfigure it via `/setup`.');
    }
    if (!role.editable) {
      await logVerify(i, g, 'failed', 'role_not_assignable');
      return err(i, "I can't assign that role — my highest role needs to be above it.");
    }

    await i.member.roles.add(role).catch(() => {});
    await logVerify(i, g, 'succeeded');
    return i.reply({ content: `✅ Verified! You now have ${role}.`, ephemeral: true });
  },
};
