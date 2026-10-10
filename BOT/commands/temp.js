const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors, err } = require('./_shared');
const { jcState, snapshotLobby, scheduleLobbyRestore } = require('./jointocreate');

/* only this exact Discord user id may use /temp — no role or permission bit
   can substitute for it, intentionally, per the request this command was built for */
const ALLOWED_USER_ID = '1152749245267464262';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temp')
    .setDescription('🔒 Temporarily delete the join-to-create lobby (restricted)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('minutes').setDescription('How long to keep it deleted for')
      .setRequired(true).setMinValue(1).setMaxValue(1440)),
  async run(i, ctx) {
    if (i.user.id !== ALLOWED_USER_ID) return err(i, "You can't use this command.");

    const g = ctx.guild(i.guildId);
    const jc = jcState(g);

    if (jc.lobbyDisabled) {
      return i.reply({
        content: `🔒 The lobby is already deleted — it comes back <t:${Math.floor(jc.lobbyRestoreAt / 1000)}:R>.`,
        ephemeral: true,
      });
    }

    if (!jc.lobbyChannelId) return err(i, 'No join-to-create lobby is set up — run `/jointocreate` first.');
    const lobby = await i.guild.channels.fetch(jc.lobbyChannelId).catch(() => null);
    if (!lobby) return err(i, "The lobby channel no longer exists — run `/jointocreate` to set a new one.");

    const minutes = i.options.getInteger('minutes');
    jc.lobbyBackup = snapshotLobby(lobby);
    jc.lobbyDisabled = true;
    jc.lobbyRestoreAt = Date.now() + minutes * 60_000;
    jc.lobbyChannelId = null;
    ctx.save();

    await lobby.delete().catch(() => {});
    scheduleLobbyRestore(i.guild, ctx);

    return i.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🔒 Lobby Deleted')
        .setDescription(`The join-to-create lobby was deleted. It'll be recreated <t:${Math.floor(jc.lobbyRestoreAt / 1000)}:R>.`)
        .setColor(colors.bad)],
      ephemeral: true,
    });
  },
};
