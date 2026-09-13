const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits,
} = require('discord.js');
const { colors, row, err, textChannels, voiceChannels, categories, menu, msgDefaults } = require('./_shared');
const { jcState } = require('./jointocreate');
const { hpState, hpWarnPayload } = require('./honeypot');

/* ═══════════════════════════ /setup — quick-start wizard ═══════════════════════════
   For each channel-dependent auto-feature: pick an existing channel, or have the bot
   create one for you. Everything here writes into the same state the feature's own
   dashboard command (/jointocreate, /logs, /welcome, /goodbye) reads — this is just a
   faster front door for first-time setup, not a replacement for those commands. */

/* server overview — cached data only, no extra API calls */
function serverOverview(i) {
  const chans = i.guild.channels.cache;
  const text = chans.filter(c => c.type === ChannelType.GuildText).size;
  const voice = chans.filter(c => c.type === ChannelType.GuildVoice).size;
  const cats = chans.filter(c => c.type === ChannelType.GuildCategory).size;
  return `**${i.guild.name}** — ${i.guild.memberCount} members • ${text} text • ${voice} voice • ${cats} categories`;
}

/* read-only status — deliberately does NOT call jcState/hpState/msgDefaults, since those
   normalize-and-write full defaults (including honeypot's default title/description).
   Calling them just to render the dashboard would silently create/persist settings for
   a feature the admin never touched. Plain optional reads only. */
function setupEmbed(i, g) {
  const jc = g.jointocreate ?? {};
  const w = g.welcome ?? {};
  const gb = g.goodbye ?? {};
  const h = g.honeypot ?? {};
  const cat = jc.categoryId ? i.guild.channels.cache.get(jc.categoryId) : null;
  return new EmbedBuilder()
    .setTitle('🧭 Quick Setup')
    .setDescription(
      `${serverOverview(i)}\n\n`
      + 'Pick a channel yourself, or let the bot create one for you. This only touches\n'
      + 'the channel + on/off switch for each feature — use its own command for everything else.\n\n'
      + `🎙️ **Join-to-Create** — Lobby: ${jc.lobbyChannelId ? `<#${jc.lobbyChannelId}>` : '*not set*'} • Category: ${cat ? `\`${cat.name}\`` : '*not set*'}\n`
      + `📜 **Logs** — ${g.logsChannelId ? `<#${g.logsChannelId}>` : '*not set*'}\n`
      + `👋 **Welcome** — ${w.channelId ? `<#${w.channelId}>` : '*not set*'} (${w.enabled ? 'enabled' : 'disabled'})\n`
      + `🚪 **Goodbye** — ${gb.channelId ? `<#${gb.channelId}>` : '*not set*'} (${gb.enabled ? 'enabled' : 'disabled'})\n`
      + `🍯 **Honeypot** — Trap: ${h.channelIds?.length ? h.channelIds.map(c => `<#${c}>`).join(', ') : '*not set*'} (${h.enabled ? 'deployed' : 'disabled'}) • Log: ${h.logChannelId ? `<#${h.logChannelId}>` : '*not set*'}`,
    )
    .setColor(colors.main)
    .setFooter({ text: 'Pick a feature below — you can configure them in any order' });
}

function dashboardView(i, g) {
  return { embeds: [setupEmbed(i, g)], components: dashboardPanel() };
}

function dashboardPanel() {
  return [
    row(
      new ButtonBuilder().setCustomId('setup:jtc').setLabel('🎙️ Join-to-Create').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('setup:hpot').setLabel('🍯 Honeypot').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('setup:logs').setLabel('📜 Logs').setStyle(ButtonStyle.Primary),
    ),
    row(
      new ButtonBuilder().setCustomId('setup:wlcm').setLabel('👋 Welcome').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('setup:gbye').setLabel('🚪 Goodbye').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('setup:close').setLabel('✖️ Close').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/* a "pick or create" row for one channel slot — nav (Back/Close) is added separately by
   navRow() so combining two of these (e.g. jtc's lobby + category) never duplicates a custom_id */
function pickOrCreatePanel(pickId, createId, createLabel) {
  return row(
    new ButtonBuilder().setCustomId(pickId).setLabel('📌 Pick Existing').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(createId).setLabel(createLabel).setStyle(ButtonStyle.Success),
  );
}

/* Back/Close row appended below a channel-select dropdown so it's never a dead end */
function navRow() {
  return row(
    new ButtonBuilder().setCustomId('setup:back').setLabel('⬅️ Back').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('setup:close').setLabel('✖️ Close').setStyle(ButtonStyle.Danger),
  );
}

/* step 2 of join-to-create: the category is already resolved by this point */
function jtcLobbyStepView() {
  return {
    content: '🎙️ **Step 2/2** — pick an existing voice channel for the lobby, or have the bot create one:',
    embeds: [],
    components: [pickOrCreatePanel('setup:jtcLobbyPick', 'setup:jtcLobbyCreate', '✨ Create Lobby'), navRow()],
  };
}

/* step 2 of goodbye: the category (or 'none') is already resolved and embedded in the customId */
function gbyeChannelStepView(catId) {
  return {
    content: '🚪 **Step 2/2** — pick an existing channel for goodbye messages, or have the bot create one:',
    embeds: [],
    components: [pickOrCreatePanel(`setup:gbyeChPick:${catId}`, `setup:gbyeChCreate:${catId}`, '✨ Create #goodbye'), navRow()],
  };
}

/* step 2 of honeypot: the trap channel is already resolved by this point */
function hpotLogStepView() {
  return {
    content: '🍯 **Step 2/2** — pick a log channel for evidence (optional), have the bot create one, or skip:',
    embeds: [],
    components: [
      pickOrCreatePanel('setup:hpotLogPick', 'setup:hpotLogCreate', '✨ Create #honeypot-logs'),
      row(new ButtonBuilder().setCustomId('setup:hpotLogSkip').setLabel('⏭️ Skip — no log channel').setStyle(ButtonStyle.Secondary)),
      navRow(),
    ],
  };
}

/* deploy the trap warning message into a newly-set honeypot channel, mirroring /honeypot's own toggle/channelsSel logic */
async function hpotDeployTrap(guild, h, channelId) {
  h.enabled = true;
  h.warnMessageIds ??= {};
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (!ch) return;
  const oldId = h.warnMessageIds[channelId];
  if (oldId) await ch.messages.delete(oldId).catch(() => {});
  const msg = await ch.send(hpWarnPayload(h)).catch(() => null);
  if (msg) h.warnMessageIds[channelId] = msg.id;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('🧭 Quick-start wizard — wire up channels for join-to-create, honeypot, logs, welcome & goodbye')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ns: 'setup',

  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    ctx.save();
    return i.reply({ ...dashboardView(i, g), content: '', ephemeral: true });
  },

  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const parts = i.customId.split(':');
    const action = parts[1];

    if (action === 'close') return i.update({ content: '✖️ Setup closed.', embeds: [], components: [] });
    if (action === 'back') return i.update({ ...dashboardView(i, g), content: '' });

    if (action === 'jtc') {
      return i.update({
        content: '🎙️ **Join-to-Create** — **Step 1/2** — pick an existing category for temp VCs, or have the bot create one (or skip):',
        embeds: [],
        components: [
          pickOrCreatePanel('setup:jtcCatPick', 'setup:jtcCatCreate', '✨ Create Category'),
          row(new ButtonBuilder().setCustomId('setup:jtcCatSkip').setLabel('⏭️ Skip — no category').setStyle(ButtonStyle.Secondary)),
          navRow(),
        ],
      });
    }
    if (action === 'hpot') {
      return i.update({
        content: '🍯 **Honeypot** — **Step 1/2** — pick an existing trap channel, or have the bot create one:',
        embeds: [],
        components: [pickOrCreatePanel('setup:hpotTrapPick', 'setup:hpotTrapCreate', '✨ Create Trap Channel'), navRow()],
      });
    }
    if (action === 'logs') {
      return i.update({
        content: '📜 **Logs** — where should error logs post?',
        embeds: [],
        components: [pickOrCreatePanel('setup:logsPick', 'setup:logsCreate', '✨ Create #bot-logs'), navRow()],
      });
    }
    if (action === 'wlcm') {
      return i.update({
        content: '👋 **Welcome** — where should welcome messages post?',
        embeds: [],
        components: [pickOrCreatePanel('setup:wlcmPick', 'setup:wlcmCreate', '✨ Create #welcome'), navRow()],
      });
    }
    if (action === 'gbye') {
      return i.update({
        content: '🚪 **Goodbye** — **Step 1/2** — pick an existing category for the goodbye channel, or have the bot create one (or skip):',
        embeds: [],
        components: [
          pickOrCreatePanel('setup:gbyeCatPick', 'setup:gbyeCatCreate', '✨ Create Category'),
          row(new ButtonBuilder().setCustomId('setup:gbyeCatSkip').setLabel('⏭️ Skip — no category').setStyle(ButtonStyle.Secondary)),
          navRow(),
        ],
      });
    }

    /* ── "pick existing" buttons open a channel select ── */
    if (action === 'jtcLobbyPick') {
      const chans = voiceChannels(i, 25);
      if (!chans.length) return err(i, 'No voice channels found.');
      const sel = menu('setup:jtcLobbySel', '🎙️ Pick the lobby channel…', chans.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '🎙️' })));
      return i.update({ content: '🎙️ Pick the lobby channel:', components: [row(sel), navRow()] });
    }
    if (action === 'jtcCatPick') {
      const cats = categories(i, 25);
      if (!cats.length) return err(i, 'No categories found.');
      const sel = menu('setup:jtcCatSel', '📁 Pick the temp-VC category…', cats.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁' })));
      return i.update({ content: '📁 **Step 1/2** — pick the category temp VCs will be created in:', embeds: [], components: [row(sel), navRow()] });
    }
    if (action === 'jtcCatSkip') {
      const jc = jcState(g);
      jc.categoryId = null;
      ctx.save();
      return i.update(jtcLobbyStepView());
    }
    if (action === 'jtcCatCreate') {
      const modal = new ModalBuilder().setCustomId('setup:jtcCatModal').setTitle('Name the Category');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Category name')
        .setStyle(TextInputStyle.Short).setMaxLength(100).setValue('Temporary Voices').setRequired(true)));
      return i.showModal(modal);
    }
    if (action === 'hpotTrapPick') {
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = menu('setup:hpotTrapSel', '🍯 Pick the trap channel…', chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🍯' })));
      return i.update({ content: '🍯 **Step 1/2** — pick the trap channel:', embeds: [], components: [row(sel), navRow()] });
    }
    if (action === 'hpotLogPick') {
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = menu('setup:hpotLogSel', '📜 Pick the honeypot log channel…', chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜' })));
      return i.update({ content: '📜 Pick the honeypot evidence log channel:', components: [row(sel), navRow()] });
    }
    if (action === 'hpotLogSkip') {
      const h = hpState(g);
      h.logChannelId = null;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: '✅ Honeypot deployed — no log channel set.' });
    }
    if (action === 'logsPick') {
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = menu('setup:logsSel', '📜 Pick the logs channel…', chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '📜' })));
      return i.update({ content: '📜 Pick the error-log channel:', components: [row(sel), navRow()] });
    }
    if (action === 'wlcmPick') {
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = menu('setup:wlcmSel', '👋 Pick the welcome channel…', chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '👋' })));
      return i.update({ content: '👋 Pick the welcome channel:', components: [row(sel), navRow()] });
    }
    if (action === 'gbyeCatPick') {
      const cats = categories(i, 25);
      if (!cats.length) return err(i, 'No categories found.');
      const sel = menu('setup:gbyeCatSel', '📁 Pick the category…', cats.map(c => ({ label: c.name.slice(0, 100), value: c.id, emoji: '📁' })));
      return i.update({ content: '📁 **Step 1/2** — pick the category the goodbye channel lives in:', embeds: [], components: [row(sel), navRow()] });
    }
    if (action === 'gbyeCatSkip') return i.update(gbyeChannelStepView('none'));
    if (action === 'gbyeCatCreate') {
      const modal = new ModalBuilder().setCustomId('setup:gbyeCatModal').setTitle('Name the Category');
      modal.addComponents(row(new TextInputBuilder().setCustomId('v').setLabel('Category name')
        .setStyle(TextInputStyle.Short).setMaxLength(100).setValue('Server Notifications').setRequired(true)));
      return i.showModal(modal);
    }
    if (action === 'gbyeChPick') {
      const catId = parts[2];
      const chans = textChannels(i, 25);
      if (!chans.length) return err(i, 'No text channels found.');
      const sel = menu(`setup:gbyeChSel:${catId}`, '🚪 Pick the goodbye channel…', chans.map(c => ({ label: `#${c.name}`.slice(0, 100), value: c.id, emoji: '🚪' })));
      return i.update({ content: '🚪 Pick the goodbye channel:', components: [row(sel), navRow()] });
    }

    /* ── "create for me" buttons act immediately, no picker needed — then back to the dashboard ── */
    if (action === 'jtcLobbyCreate') {
      const jc = jcState(g);
      const ch = await i.guild.channels.create({
        name: '🎙️ Join to Create', type: ChannelType.GuildVoice, parent: jc.categoryId ?? null,
      }).catch(() => null);
      if (!ch) return err(i, "Couldn't create the channel — check my permissions.");
      jc.lobbyChannelId = ch.id;
      jc.enabled = true;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Created ${ch} as the join-to-create lobby.` });
    }
    if (action === 'hpotTrapCreate') {
      const h = hpState(g);
      const ch = await i.guild.channels.create({ name: 'trap-channel', type: ChannelType.GuildText }).catch(() => null);
      if (!ch) return err(i, "Couldn't create the channel — check my permissions.");
      h.channelIds = [ch.id];
      await hpotDeployTrap(i.guild, h, ch.id);
      ctx.save();
      const next = hpotLogStepView();
      return i.update({ ...next, content: `✅ Created ${ch} and deployed the trap.\n\n${next.content}` });
    }
    if (action === 'hpotLogCreate') {
      const h = hpState(g);
      const ch = await i.guild.channels.create({
        name: 'honeypot-logs', type: ChannelType.GuildText,
        permissionOverwrites: [{ id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
      }).catch(() => null);
      if (!ch) return err(i, "Couldn't create the channel — check my permissions.");
      h.logChannelId = ch.id;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Created ${ch} (hidden from @everyone) for honeypot evidence.` });
    }
    if (action === 'logsCreate') {
      const ch = await i.guild.channels.create({
        name: 'bot-logs', type: ChannelType.GuildText,
        permissionOverwrites: [{ id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }],
      }).catch(() => null);
      if (!ch) return err(i, "Couldn't create the channel — check my permissions.");
      g.logsChannelId = ch.id;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Created ${ch} (hidden from @everyone) for error logs.` });
    }
    if (action === 'wlcmCreate') {
      const ch = await i.guild.channels.create({ name: 'welcome', type: ChannelType.GuildText }).catch(() => null);
      if (!ch) return err(i, "Couldn't create the channel — check my permissions.");
      g.welcome ??= msgDefaults('welcome');
      g.welcome.channelId = ch.id;
      g.welcome.enabled = true;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Created ${ch} and enabled welcome messages there.` });
    }
    if (action === 'gbyeChCreate') {
      const catId = parts[2];
      const ch = await i.guild.channels.create({
        name: 'goodbye', type: ChannelType.GuildText, parent: catId !== 'none' ? catId : null,
      }).catch(() => null);
      if (!ch) return err(i, "Couldn't create the channel — check my permissions.");
      g.goodbye ??= msgDefaults('goodbye');
      g.goodbye.channelId = ch.id;
      g.goodbye.enabled = true;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Created ${ch} and enabled goodbye messages there.` });
    }
  },

  async onSelect(i, ctx) {
    const g = ctx.guild(i.guildId);

    if (i.customId === 'setup:jtcLobbySel') {
      const jc = jcState(g);
      jc.lobbyChannelId = i.values[0];
      jc.enabled = true;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Lobby set to <#${jc.lobbyChannelId}> — join-to-create is now enabled.` });
    }
    if (i.customId === 'setup:jtcCatSel') {
      const jc = jcState(g);
      jc.categoryId = i.values[0];
      ctx.save();
      const cat = i.guild.channels.cache.get(jc.categoryId);
      const next = jtcLobbyStepView();
      return i.update({ ...next, content: `✅ Temp VCs will be created in \`${cat?.name ?? 'that category'}\`.\n\n${next.content}` });
    }
    if (i.customId === 'setup:hpotTrapSel') {
      const h = hpState(g);
      const chId = i.values[0];
      h.channelIds = [chId];
      await hpotDeployTrap(i.guild, h, chId);
      ctx.save();
      const next = hpotLogStepView();
      return i.update({ ...next, content: `✅ Trap deployed in <#${chId}>.\n\n${next.content}` });
    }
    if (i.customId === 'setup:hpotLogSel') {
      const h = hpState(g);
      h.logChannelId = i.values[0];
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Honeypot evidence will log in <#${h.logChannelId}>.` });
    }
    if (i.customId === 'setup:logsSel') {
      g.logsChannelId = i.values[0];
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Errors will be logged in <#${g.logsChannelId}>.` });
    }
    if (i.customId === 'setup:wlcmSel') {
      g.welcome ??= msgDefaults('welcome');
      g.welcome.channelId = i.values[0];
      g.welcome.enabled = true;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Welcome messages will post in <#${g.welcome.channelId}>.` });
    }
    if (i.customId === 'setup:gbyeCatSel') {
      const catId = i.values[0];
      const cat = i.guild.channels.cache.get(catId);
      const next = gbyeChannelStepView(catId);
      return i.update({ ...next, content: `✅ Goodbye channel will be created in \`${cat?.name ?? 'that category'}\` if you create one.\n\n${next.content}` });
    }
    if (i.customId.startsWith('setup:gbyeChSel:')) {
      g.goodbye ??= msgDefaults('goodbye');
      g.goodbye.channelId = i.values[0];
      g.goodbye.enabled = true;
      ctx.save();
      return i.update({ ...dashboardView(i, g), content: `✅ Goodbye messages will post in <#${g.goodbye.channelId}>.` });
    }
  },

  async onModal(i, ctx) {
    const g = ctx.guild(i.guildId);
    if (i.customId === 'setup:jtcCatModal') {
      const jc = jcState(g);
      const name = i.fields.getTextInputValue('v').trim().slice(0, 100) || 'Temporary Voices';
      const cat = await i.guild.channels.create({ name, type: ChannelType.GuildCategory }).catch(() => null);
      if (!cat) return err(i, "Couldn't create the category — check my permissions.");
      jc.categoryId = cat.id;
      ctx.save();
      const next = jtcLobbyStepView();
      return i.update({ ...next, content: `✅ Created category \`${cat.name}\`.\n\n${next.content}` });
    }
    if (i.customId === 'setup:gbyeCatModal') {
      const name = i.fields.getTextInputValue('v').trim().slice(0, 100) || 'Server Notifications';
      const cat = await i.guild.channels.create({ name, type: ChannelType.GuildCategory }).catch(() => null);
      if (!cat) return err(i, "Couldn't create the category — check my permissions.");
      const next = gbyeChannelStepView(cat.id);
      return i.update({ ...next, content: `✅ Created category \`${cat.name}\`.\n\n${next.content}` });
    }
  },
};
