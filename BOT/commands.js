const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
  PermissionFlagsBits, ChannelType,
} = require('discord.js');

/* ══════════════════════ shared helpers ══════════════════════ */
const colors = {
  ok: 0x57F287,
  main: 0x5865F2,
  warn: 0xFEE75C,
  bad: 0xED4245,
  pink: 0xEB459E,
};

const PH = (t, m) => t
  .replaceAll('{user}', `<@${m.id}>`)
  .replaceAll('{username}', m.user.username)
  .replaceAll('{server}', m.guild.name)
  .replaceAll('{membercount}', String(m.guild.memberCount));

const row = (...components) => new ActionRowBuilder().addComponents(...components);

const err = (i, msg) => i.reply({ content: `⚠️ ${msg}`, ephemeral: true });

const modEmbed = (emoji, title, color, lines) => {
  const e = new EmbedBuilder()
    .setTitle(`${emoji} ${title}`)
    .setColor(color)
    .setTimestamp();
  if (lines && lines.length) e.setDescription(lines.map(l => `**»** ${l}`).join('\n'));
  return e;
};

const commands = [

  /* ══════════════════════ CONFIG ══════════════════════ */

  /* 1. /welcome */
  {
    data: new SlashCommandBuilder()
      .setName('welcome')
      .setDescription('👋 Configure the welcome message (interactive button panel)'),
    ns: 'cfg',
    async run(i, c) {
      const cfg = c.guild(i.guild.id).welcome;
      return i.reply({ embeds: [panelEmbed('welcome', cfg)], components: panelRows('welcome'), ephemeral: true });
    },
    async onButton(i, c) {
      const parts = i.customId.split(':');      // cfg : welcome : xxx
      const type = parts[1];
      const arg = parts[2];
      const cfg = c.guild(i.guild.id)[type];

      if (arg === 'toggle') {
        cfg.enabled = !cfg.enabled;
        c.save();
        return i.update({ embeds: [panelEmbed(type, cfg)], components: panelRows(type) });
      }

      if (arg === 'reset') {
        c.guild(i.guild.id)[type] = {};
        c.save();
        return i.update({ embeds: [panelEmbed(type, {})], components: panelRows(type) });
      }

      if (arg === 'test') {
        const fake = { id: i.user.id, user: i.user, guild: i.guild };
        return i.reply({ embeds: [testEmbed(type, cfg, fake)], ephemeral: true });
      }

      if (arg === 'channel') {
        await i.reply({ content: `📋 Reply with a channel mention for the ${type} channel:`, ephemeral: true });
        const collected = await i.channel.awaitMessages({
          filter: m => m.author.id === i.user.id,
          max: 1,
          time: 30000,
        });
        const msg = collected.first();
        const target = msg ? msg.mentions.channels.first() : null;
        if (!target) return;
        cfg.channelId = target.id;
        cfg.enabled = true;
        c.save();
        await msg.delete().catch(() => {});
        return i.editReply({
          content: `✅ Channel set to <#${target.id}>`,
          embeds: [panelEmbed(type, cfg)],
          components: panelRows(type),
        });
      }

      // remaining args open modals: message / title / color / images
      const fieldMap = {
        message: [['message', 'Text — {user} {username} {server} {membercount}', TextInputStyle.Paragraph]],
        title: [['title', 'Embed title', TextInputStyle.Short]],
        color: [['color', 'Hex color, e.g. #5865F2', TextInputStyle.Short]],
        images: [
          ['banner', 'Banner image URL', TextInputStyle.Short],
          ['pfp', 'PFP / thumbnail URL', TextInputStyle.Short],
        ],
      };

      const modal = new ModalBuilder()
        .setCustomId(`cfg:${type}:${arg}`)
        .setTitle('Edit settings');

      for (const fieldDef of fieldMap[arg]) {
        const [id, label, style] = fieldDef;
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(style)
            .setRequired(false)
            .setValue(cfg[id] ?? ''),
        ));
      }
      return i.showModal(modal);
    },
    async onModal(i, c) {
      const parts = i.customId.split(':');      // cfg : welcome : xxx
      const type = parts[1];
      const cfg = c.guild(i.guild.id)[type];

      for (const [, field] of i.fields.fields) {
        if (field.value) cfg[field.customId] = field.value;
        else delete cfg[field.customId];
      }
      cfg.enabled ??= true;
      c.save();
      return i.update({ embeds: [panelEmbed(type, cfg)], components: panelRows(type) });
    },
  },

  /* 2. /goodbye */
  {
    data: new SlashCommandBuilder()
      .setName('goodbye')
      .setDescription('🚪 Configure the goodbye message (interactive button panel)'),
    async run(i, c) {
      const cfg = c.guild(i.guild.id).goodbye;
      return i.reply({ embeds: [panelEmbed('goodbye', cfg)], components: panelRows('goodbye'), ephemeral: true });
    },
    /* shares the 'cfg' namespace buttons/modals with /welcome — handled above */
  },

  /* 3. /announce */
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('📢 Create an announcement (compose in a popup)')
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('ping').setDescription('Mention to include at the top')
        .addChoices(
          { name: 'everyone', value: 'everyone' },
          { name: 'here', value: 'here' },
          { name: 'none', value: 'none' },
        )),
    ns: 'ann',
    async run(i) {
      const target = i.options.getChannel('channel');
      const me = i.guild.members.me;

      if (!target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
        return err(i, `I can't send messages in ${target}. Check my permissions there.`);
      }

      pendingAnnounce.set(i.user.id, {
        channelId: target.id,
        ping: i.options.getString('ping') ?? 'none',
      });

      const modal = new ModalBuilder()
        .setCustomId(`ann:compose:${i.user.id}`)
        .setTitle('📢 Compose Announcement');

      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(256)
          .setPlaceholder('📢 Announcement')),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(4000)
          .setPlaceholder('What should the announcement say?')),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId('color')
          .setLabel('Hex color (optional, e.g. #5865F2)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(7)
          .setPlaceholder('#5865F2')),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId('banner')
          .setLabel('Banner image URL (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('https://...')),
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId('delay')
          .setLabel('Delay in minutes (optional, empty = now)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(5)
          .setPlaceholder('e.g. 30')),
      );

      return i.showModal(modal);
    },
    async onModal(i) {
      const session = pendingAnnounce.get(i.user.id);
      if (!session) return err(i, 'Session expired — run `/announce` again.');
      pendingAnnounce.delete(i.user.id);

      const target = await i.client.channels.fetch(session.channelId).catch(() => null);
      if (!target) return err(i, 'Target channel no longer exists.');

      const title = i.fields.getTextInputValue('title') || '📢 Announcement';
      const message = i.fields.getTextInputValue('message');
      const colorRaw = i.fields.getTextInputValue('color');
      const banner = i.fields.getTextInputValue('banner');
      const delayRaw = i.fields.getTextInputValue('delay');

      const delay = delayRaw ? parseInt(delayRaw, 10) : 0;
      if (delayRaw && (!Number.isFinite(delay) || delay < 1)) {
        return err(i, 'Delay must be a whole number of minutes (1 or more).');
      }
      if (banner && !banner.startsWith('http')) {
        return err(i, 'Banner must be a valid URL starting with http(s)://');
      }

      const color = colorRaw ? parseInt(colorRaw.replace('#', ''), 16) : colors.main;
      const payload = {
        content: { everyone: '@everyone', here: '@here', none: null }[session.ping],
        embeds: [new EmbedBuilder()
          .setTitle(title)
          .setDescription(message)
          .setColor(color)
          .setImage(banner || null)
          .setFooter({ text: `Announced by ${i.user.tag}` })
          .setTimestamp()],
        allowedMentions: { parse: ['everyone'] },
      };

      if (delay) {
        const key = `${i.user.id}:${target.id}`;
        const timer = setTimeout(() => target.send(payload).catch(console.error), delay * 60000);
        pendingTimers.set(key, timer);

        const schedEmbed = new EmbedBuilder()
          .setTitle('📅 Scheduled')
          .setColor(colors.warn)
          .setDescription(`**» Channel** ${target}\n**» Posts** in **${delay} min** — <t:${Math.floor(Date.now() / 1000 + delay * 60)}:R>\n\n*Press Cancel to stop it before it posts.*`);

        return i.reply({
          embeds: [schedEmbed, ...payload.embeds],
          components: [row(new ButtonBuilder()
            .setCustomId(`ann:cancel:${target.id}`)
            .setLabel('Cancel')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger))],
          ephemeral: true,
        });
      }

      pendingPayloads.set(`${i.user.id}:${i.id}`, { payload, channelId: target.id });

      const previewEmbed = new EmbedBuilder()
        .setTitle('📤 Preview')
        .setColor(colors.main)
        .setDescription(`Will post in ${target}${session.ping !== 'none' ? ` with **@${session.ping}**` : ' without a ping'}.\nPress **Send** to post it.`);

      return i.reply({
        embeds: [previewEmbed, ...payload.embeds],
        components: [row(
          new ButtonBuilder().setCustomId(`ann:send:${i.id}`).setLabel('Send').setEmoji('✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`ann:discard:${i.id}`).setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
        )],
        ephemeral: true,
      });
    },
    async onButton(i) {
      const parts = i.customId.split(':');      // ann : action : arg
      const action = parts[1];
      const arg = parts[2];

      if (action === 'cancel') {
        const key = `${i.user.id}:${arg}`;
        const timer = pendingTimers.get(key);
        clearTimeout(timer);
        pendingTimers.delete(key);
        const msg = timer ? '✖️ **Cancelled.**' : '⚠️ Timer already fired.';
        return i.update({ content: msg, embeds: [], components: [] });
      }

      const key = `${i.user.id}:${arg}`;
      const pending = pendingPayloads.get(key);

      if (action === 'discard') {
        pendingPayloads.delete(key);
        return i.update({ content: '✖️ **Cancelled.**', embeds: [], components: [] });
      }

      if (!pending) {
        return i.update({ content: '⚠️ Preview expired — run `/announce` again.', embeds: [], components: [] });
      }

      pendingPayloads.delete(key);
      const target = await i.client.channels.fetch(pending.channelId).catch(() => null);
      if (target) await target.send(pending.payload);
      return i.update({ content: '✅ **Sent!**', embeds: [], components: [] });
    },
  },

  /* 4. /jointocreate */
  {
    data: new SlashCommandBuilder()
      .setName('jointocreate')
      .setDescription('🎙️ Join-to-Create voice channels')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption(o => o.setName('action').setDescription('enable / disable').setRequired(true)
        .addChoices(
          { name: 'enable', value: 'e' },
          { name: 'disable', value: 'd' },
        ))
      .addChannelOption(o => o.setName('category').setDescription('Category to create the lobby in (required for enable)').addChannelTypes(ChannelType.GuildCategory))
      .addStringOption(o => o.setName('lobby_name').setDescription('Custom lobby channel name')),
    async run(i, c) {
      const store = c.guild(i.guild.id);

      if (i.options.getString('action') === 'd') {
        if (!store.jtc || !store.jtc.lobbyId) return err(i, 'Join-to-Create is not currently enabled.');
        const lobby = i.guild.channels.cache.get(store.jtc.lobbyId);
        if (lobby) await lobby.delete().catch(() => {});
        delete store.jtc;
        c.save();
        return i.reply({
          embeds: [modEmbed('❌', 'JTC Disabled', colors.bad, [
            'The lobby channel was deleted.',
            'Users can no longer create voice channels.',
          ])],
          ephemeral: true,
        });
      }

      const category = i.options.getChannel('category');
      if (!category) return err(i, 'Pick a **category** for the lobby to live in.');

      const lobbyName = i.options.getString('lobby_name') ?? '➕ Join to Create';
      const lobby = await i.guild.channels.create({
        name: lobbyName,
        type: ChannelType.GuildVoice,
        parent: category.id,
      });

      store.jtc = { lobbyId: lobby.id, categoryId: category.id };
      c.save();

      return i.reply({
        embeds: [modEmbed('✅', 'JTC Enabled', colors.ok, [
          `**Lobby** ${lobby}`,
          `**Category** ${category.name}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 5. /autorole */
  {
    data: new SlashCommandBuilder()
      .setName('autorole')
      .setDescription('🎭 Auto-assign roles on join')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    ns: 'ar',
    run(i, c) {
      return i.reply({ embeds: [arEmbed(i, c)], components: arRows(i, c), ephemeral: true });
    },
    async onButton(i, c) {
      const parts = i.customId.split(':');      // ar : action
      const action = parts[1];

      if (action === 'clear') {
        c.guild(i.guild.id).autoroles = [];
        c.save();
        return i.update({ embeds: [arEmbed(i, c)], components: arRows(i, c) });
      }

      // action === 'add'
      await i.reply({ content: '➕ Reply with a role mention to auto-assign:', ephemeral: true });
      const collected = await i.channel.awaitMessages({
        filter: m => m.author.id === i.user.id,
        max: 1,
        time: 30000,
      });
      const msg = collected.first();
      const role = msg ? msg.mentions.roles.first() : null;

      if (role && role.id !== i.guild.id) {
        const store = c.guild(i.guild.id);
        if (role.managed) {
          await msg.reply('⚠️ That role is managed by an integration and can\'t be auto-assigned.').catch(() => {});
        } else if (!store.autoroles.includes(role.id)) {
          store.autoroles.push(role.id);
          c.save();
        }
        await msg.delete().catch(() => {});
        return i.editReply({ content: `✅ Added ${role}`, embeds: [arEmbed(i, c)], components: arRows(i, c) });
      }
    },
    async onSelect(i, c) {
      const store = c.guild(i.guild.id);
      store.autoroles = store.autoroles.filter(r => r !== i.values[0]);
      c.save();
      return i.update({ embeds: [arEmbed(i, c)], components: arRows(i, c) });
    },
  },

  /* 6. /ticket — text channels, one per user, confirm-before-close */
  {
    data: new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('🎫 Post a ticket panel with a button')
      .addChannelOption(o => o.setName('channel').setDescription('Where to post the panel (defaults to here)').addChannelTypes(ChannelType.GuildText))
      .addChannelOption(o => o.setName('category').setDescription('Category new ticket channels are created in').addChannelTypes(ChannelType.GuildCategory)),
    ns: 'tk',
    async run(i, c) {
      const category = i.options.getChannel('category');
      if (category) {
        c.guild(i.guild.id).tickets.categoryId = category.id;
        c.save();
      }
      const target = i.options.getChannel('channel') ?? i.channel;

      const panelEmbedMsg = new EmbedBuilder()
        .setTitle('🎫 Support Tickets')
        .setDescription('Press the button below to open a private ticket.\nStaff will be with you shortly.')
        .setColor(colors.main);

      await target.send({
        embeds: [panelEmbedMsg],
        components: [row(new ButtonBuilder()
          .setCustomId('tk:open')
          .setLabel('Open Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary))],
      });

      return i.reply({ content: `✅ Ticket panel posted in ${target}.`, ephemeral: true });
    },
    async onButton(i, c) {
      if (i.customId === 'tk:open') {
        const store = c.guild(i.guild.id);

        const existing = i.guild.channels.cache.find(ch => ch.topic === `ticket:${i.user.id}`);
        if (existing) return err(i, `You already have an open ticket: ${existing}`);

        await i.deferReply({ ephemeral: true });

        const ticket = await i.guild.channels.create({
          name: `ticket-${i.user.username}`,
          type: ChannelType.GuildText,
          parent: store.tickets.categoryId ?? null,
          topic: `ticket:${i.user.id}`,
          permissionOverwrites: [
            { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ],
        });

        const welcomeEmbed = new EmbedBuilder()
          .setDescription('Support will be with you shortly.\nPress **Close Ticket** when the issue is resolved.')
          .setColor(colors.main);

        await ticket.send({
          content: `🎫 Ticket for <@${i.user.id}>`,
          embeds: [welcomeEmbed],
          components: [row(new ButtonBuilder()
            .setCustomId('tk:close')
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger))],
        });

        return i.editReply({ content: `🎫 Your ticket: ${ticket}` });
      }

      if (i.customId === 'tk:close') {
        const confirmEmbed = new EmbedBuilder()
          .setDescription('🔒 Really close this ticket? This **cannot** be undone.')
          .setColor(colors.bad);

        return i.reply({
          embeds: [confirmEmbed],
          components: [row(
            new ButtonBuilder().setCustomId('tk:confirmclose').setLabel('Confirm Close').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tk:cancelclose').setLabel('Keep Open').setStyle(ButtonStyle.Secondary),
          )],
        });
      }

      if (i.customId === 'tk:confirmclose') {
        await i.update({ content: '🗑️ Closing…', embeds: [], components: [] });
        return i.channel.delete().catch(() => {});
      }

      if (i.customId === 'tk:cancelclose') {
        return i.update({ content: '✅ Ticket kept open.', embeds: [], components: [] });
      }
    },
  },

  /* 7. /poll */
  {
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('📊 Create a reaction-style poll')
      .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true).setMaxLength(256))
      .addStringOption(o => o.setName('options').setDescription('Separate options with commas (2-10)').setRequired(true).setMaxLength(1000)),
    async run(i) {
      await i.deferReply({ ephemeral: true });

      const options = i.options.getString('options').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
      if (options.length < 2) return i.editReply('⚠️ Give at least **2** options, comma-separated.');

      const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      const pollEmbed = new EmbedBuilder()
        .setTitle(`📊 ${i.options.getString('question')}`)
        .setDescription(options.map((o, x) => `${numbers[x]} ${o}`).join('\n'))
        .setColor(colors.main)
        .setFooter({ text: `Poll by ${i.user.tag}` })
        .setTimestamp();

      const poll = await i.channel.send({ embeds: [pollEmbed] });
      for (let x = 0; x < options.length; x++) {
        await poll.react(numbers[x]).catch(() => {});
      }

      return i.editReply(`✅ Poll posted with **${options.length}** options.`);
    },
  },

  /* 8. /giveaway */
  {
    data: new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('🎁 Start a giveaway (button entry)')
      .addStringOption(o => o.setName('prize').setDescription('What you\'re giving away').setRequired(true).setMaxLength(256))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(43200))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(10))
      .addChannelOption(o => o.setName('channel').setDescription('Where to post (defaults to here)').addChannelTypes(ChannelType.GuildText)),
    ns: 'gw',
    async run(i) {
      await i.deferReply({ ephemeral: true });

      const prize = i.options.getString('prize');
      const minutes = i.options.getInteger('minutes');
      const winners = i.options.getInteger('winners') ?? 1;
      const target = i.options.getChannel('channel') ?? i.channel;
      const endsAt = Date.now() + minutes * 60000;

      const draw = async (message) => {
        await message.fetch().catch(() => {});
        const reaction = message.reactions.cache.get('🎉');
        const users = reaction ? reaction.users.cache : new Map();
        const entries = [...new Set([...users.values()].filter(u => !u.bot).map(u => u.id))];
        const chosen = entries.sort(() => Math.random() - 0.5).slice(0, winners).map(id => `<@${id}>`);

        const resultEmbed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Ended')
          .setColor(colors.pink)
          .setTimestamp();

        if (chosen.length) {
          resultEmbed.setDescription(`**Prize:** ${prize}\n**Winner${winners > 1 ? 's' : ''}:** ${chosen.join(', ')}\n\nCongratulations! 🎊`);
          await message.reply({ content: chosen.join(', '), embeds: [resultEmbed] }).catch(() => {});
        } else {
          resultEmbed.setDescription(`**Prize:** ${prize}\n\n😔 No one entered the giveaway.`);
          await message.reply({ embeds: [resultEmbed] }).catch(() => {});
        }
        await message.edit({ components: [] }).catch(() => {});
      };

      const giveawayEmbed = new EmbedBuilder()
        .setTitle('🎁 GIVEAWAY')
        .setDescription(`**» Prize** ${prize}\n**» Winners** ${winners}\n**» Ends** <t:${Math.floor(endsAt / 1000)}:R>\n**» Hosted by** ${i.user}\n\n*Press the button below to enter!*`)
        .setColor(colors.pink);

      const message = await target.send({
        embeds: [giveawayEmbed],
        components: [row(new ButtonBuilder()
          .setCustomId('gw:enter')
          .setLabel('Enter')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Success))],
      });

      setTimeout(() => draw(message), minutes * 60000);

      return i.editReply(`✅ Giveaway started in ${target} for **${prize}** (${minutes} min, ${winners} winner${winners > 1 ? 's' : ''}).`);
    },
    async onButton(i) {
      if (i.customId === 'gw:enter') {
        return i.reply({ content: '🎉 **You\'re entered!** Good luck.', ephemeral: true });
      }
    },
  },

  /* ══════════════════════ MODERATION ══════════════════════ */

  /* 9. /purge */
  {
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('🧹 Bulk delete messages')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption(o => o.setName('amount').setDescription('How many messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user')),
    async run(i) {
      await i.deferReply({ ephemeral: true });

      const me = i.guild.members.me;
      if (!i.channel.permissionsFor(me).has(PermissionFlagsBits.ManageMessages)) {
        return i.editReply('⚠️ I need the **Manage Messages** permission in this channel.');
      }

      const user = i.options.getUser('user');
      const fetched = await i.channel.messages.fetch({ limit: 100 });
      const pool = user ? fetched.filter(m => m.author.id === user.id) : fetched;
      const deleted = await i.channel.bulkDelete(pool.first(i.options.getInteger('amount')), true).catch(() => null);

      if (!deleted) return i.editReply('⚠️ Couldn\'t delete messages — they may be older than 14 days.');

      const from = user ? ` from **${user.tag}**` : '';
      return i.editReply(`🧹 Deleted **${deleted.size}** message${deleted.size === 1 ? '' : 's'}${from}.`);
    },
  },

  /* 10. /slowmode */
  {
    data: new SlashCommandBuilder()
      .setName('slowmode')
      .setDescription('🐢 Set channel slowmode')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addIntegerOption(o => o.setName('seconds').setDescription('Seconds per message (0 to disable, max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),
    async run(i) {
      const seconds = i.options.getInteger('seconds');
      await i.channel.setRateLimitPerUser(seconds, `Slowmode set by ${i.user.tag}`);

      const rateText = seconds
        ? `1 message every **${seconds}s**`
        : '**disabled** (instant messages)';

      return i.reply({
        embeds: [modEmbed('🐢', 'Slowmode', colors.warn, [
          `**Channel** ${i.channel}`,
          `**Rate** ${rateText}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 11. /lock */
  {
    data: new SlashCommandBuilder()
      .setName('lock')
      .setDescription('🔒 Lock this channel (deny @everyone sending)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption(o => o.setName('reason').setDescription('Reason shown in the response')),
    async run(i) {
      await i.channel.permissionOverwrites.edit(
        i.guild.roles.everyone,
        { SendMessages: false },
        { reason: `Locked by ${i.user.tag}` },
      );

      const lines = [`**Channel** ${i.channel}`, `**By** ${i.user}`];
      const reason = i.options.getString('reason');
      if (reason) lines.push(`**Reason** ${reason}`);

      return i.reply({ embeds: [modEmbed('🔒', 'Channel Locked', colors.bad, lines)], ephemeral: true });
    },
  },

  /* 12. /unlock */
  {
    data: new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('🔓 Unlock this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async run(i) {
      await i.channel.permissionOverwrites.edit(
        i.guild.roles.everyone,
        { SendMessages: null },
        { reason: `Unlocked by ${i.user.tag}` },
      );

      return i.reply({
        embeds: [modEmbed('🔓', 'Channel Unlocked', colors.ok, [
          `**Channel** ${i.channel}`,
          `**By** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 13. /kick */
  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('👢 Kick a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setMaxLength(500)),
    async run(i) {
      const member = await i.options.getMember('user');
      const reason = i.options.getString('reason') ?? 'No reason provided';

      if (!member) return err(i, 'That user isn\'t in this server.');
      if (member.id === i.user.id) return err(i, 'You can\'t kick yourself.');
      if (!member.kickable) return err(i, 'I can\'t kick that member — my role is too low or they\'re protected.');

      await member.kick(`${reason} — by ${i.user.tag}`);

      return i.reply({
        embeds: [modEmbed('👢', 'Member Kicked', colors.bad, [
          `**Member** ${member.user.tag} (${member.id})`,
          `**Reason** ${reason}`,
          `**Moderator** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 14. /ban */
  {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('🔨 Ban a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the ban').setMaxLength(500))
      .addIntegerOption(o => o.setName('delete_days').setDescription('Also delete their recent messages (0-7 days)').setMinValue(0).setMaxValue(7)),
    async run(i) {
      const member = await i.options.getMember('user');
      const reason = i.options.getString('reason') ?? 'No reason provided';
      const deleteDays = i.options.getInteger('delete_days') ?? 0;

      if (!member) return err(i, 'That user isn\'t in this server.');
      if (member.id === i.user.id) return err(i, 'You can\'t ban yourself.');
      if (!member.bannable) return err(i, 'I can\'t ban that member — my role is too low or they\'re protected.');

      await member.ban({
        reason: `${reason} — by ${i.user.tag}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      return i.reply({
        embeds: [modEmbed('🔨', 'Member Banned', colors.bad, [
          `**Member** ${member.user.tag} (${member.id})`,
          `**Reason** ${reason}`,
          `**Messages purged** ${deleteDays} day${deleteDays === 1 ? '' : 's'}`,
          `**Moderator** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 15. /unban */
  {
    data: new SlashCommandBuilder()
      .setName('unban')
      .setDescription('⚖️ Unban a user by ID')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addStringOption(o => o.setName('user_id').setDescription('ID of the banned user').setRequired(true)),
    async run(i) {
      const id = i.options.getString('user_id');
      if (!/^\d{17,20}$/.test(id)) return err(i, 'That doesn\'t look like a valid user ID.');

      const user = await i.guild.members.unban(id, `Unbanned by ${i.user.tag}`).catch(() => null);
      if (!user) return err(i, 'No ban found for that ID.');

      return i.reply({
        embeds: [modEmbed('⚖️', 'User Unbanned', colors.ok, [
          `**User** ${user.tag} (${user.id})`,
          `**By** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 16. /timeout */
  {
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('⏳ Timeout a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to timeout').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes (max 40320 = 28 days)').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the timeout').setMaxLength(500)),
    async run(i) {
      const member = await i.options.getMember('user');
      const minutes = i.options.getInteger('minutes');
      const reason = i.options.getString('reason') ?? 'No reason provided';

      if (!member) return err(i, 'That user isn\'t in this server.');
      if (!member.moderatable) return err(i, 'I can\'t timeout that member — my role is too low or they\'re protected.');

      await member.timeout(minutes * 60000, `${reason} — by ${i.user.tag}`);

      return i.reply({
        embeds: [modEmbed('⏳', 'Member Timed Out', colors.warn, [
          `**Member** ${member.user.tag}`,
          `**Duration** ${minutes} min — expires <t:${Math.floor(Date.now() / 1000 + minutes * 60)}:R>`,
          `**Reason** ${reason}`,
          `**Moderator** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 17. /untimeout */
  {
    data: new SlashCommandBuilder()
      .setName('untimeout')
      .setDescription('❌ Remove a member\'s timeout')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to remove the timeout from').setRequired(true)),
    async run(i) {
      const member = await i.options.getMember('user');
      if (!member) return err(i, 'That user isn\'t in this server.');
      if (!member.isCommunicationDisabled()) return err(i, 'That member isn\'t timed out.');

      await member.timeout(null, `Timeout removed by ${i.user.tag}`);

      return i.reply({
        embeds: [modEmbed('❌', 'Timeout Removed', colors.ok, [
          `**Member** ${member.user.tag}`,
          `**By** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 18. /warn */
  {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('⚠️ Warn a member (saved to their record)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to warn').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(true).setMaxLength(500)),
    async run(i, c) {
      const user = i.options.getUser('user');
      const store = c.guild(i.guild.id);
      if (!store.warns[user.id]) store.warns[user.id] = [];
      const warnings = store.warns[user.id];

      warnings.push({
        by: i.user.tag,
        reason: i.options.getString('reason'),
        at: Date.now(),
      });
      c.save();

      const dmSent = await user.send(`⚠️ You were warned in **${i.guild.name}**: ${i.options.getString('reason')}`)
        .then(() => true)
        .catch(() => false);

      return i.reply({
        embeds: [modEmbed('⚠️', 'Member Warned', colors.warn, [
          `**Member** ${user.tag}`,
          `**Reason** ${i.options.getString('reason')}`,
          `**Total warnings** ${warnings.length}`,
          `**DM delivered** ${dmSent ? '✅' : '❌ (DMs closed)'}`,
          `**Moderator** ${i.user}`,
        ])],
        ephemeral: true,
      });
    },
  },

  /* 19. /warnings */
  {
    data: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('📋 View a member\'s warning record')
      .addUserOption(o => o.setName('user').setDescription('Member to look up').setRequired(true)),
    async run(i, c) {
      const user = i.options.getUser('user');
      const warnings = c.guild(i.guild.id).warns[user.id] ?? [];

      const description = warnings.length
        ? warnings.map((w, x) => `**${x + 1}.** ${w.reason}\n> *by ${w.by} · <t:${Math.floor(w.at / 1000)}:R>*`).join('\n')
        : '*Clean record — no warnings.*';

      const listEmbed = new EmbedBuilder()
        .setTitle(`📋 Warnings — ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .setDescription(description)
        .setColor(warnings.length ? colors.warn : colors.ok)
        .setFooter({ text: `${warnings.length} total warning${warnings.length === 1 ? '' : 's'}` });

      return i.reply({ embeds: [listEmbed], ephemeral: true });
    },
  },

  /* 20. /clearwarnings */
  {
    data: new SlashCommandBuilder()
      .setName('clearwarnings')
      .setDescription('🧽 Clear a member\'s warning record')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member whose warnings to clear').setRequired(true)),
    async run(i, c) {
      const user = i.options.getUser('user');
      const store = c.guild(i.guild.id);
      const had = (store.warns[user.id] ?? []).length;
      store.warns[user.id] = [];
      c.save();
      return i.reply({ content: `🧽 Cleared **${had}** warning${had === 1 ? '' : 's'} for **${user.tag}**.`, ephemeral: true });
    },
  },

  /* 21. /roleadd */
  {
    data: new SlashCommandBuilder()
      .setName('roleadd')
      .setDescription('➕ Give a role to a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('user').setDescription('Member to give the role to').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true)),
    async run(i) {
      const member = await i.options.getMember('user');
      const role = i.options.getRole('role');

      if (!member) return err(i, 'That user isn\'t in this server.');
      if (role.managed) return err(i, 'That role is managed by an integration and can\'t be given manually.');
      if (!role.editable) return err(i, 'I can\'t manage that role — it\'s above my highest role.');

      await member.roles.add(role, `Added by ${i.user.tag}`);
      return i.reply({ content: `➕ Gave ${role} to ${member}.`, ephemeral: true });
    },
  },

  /* 22. /roleremove */
  {
    data: new SlashCommandBuilder()
      .setName('roleremove')
      .setDescription('➖ Remove a role from a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('user').setDescription('Member to remove the role from').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)),
    async run(i) {
      const member = await i.options.getMember('user');
      const role = i.options.getRole('role');

      if (!member) return err(i, 'That user isn\'t in this server.');
      if (!role.editable) return err(i, 'I can\'t manage that role — it\'s above my highest role.');
      if (!member.roles.cache.has(role.id)) return err(i, `${member} doesn't have ${role}.`);

      await member.roles.remove(role, `Removed by ${i.user.tag}`);
      return i.reply({ content: `➖ Removed ${role} from ${member}.`, ephemeral: true });
    },
  },

  /* 23. /nickname */
  {
    data: new SlashCommandBuilder()
      .setName('nickname')
      .setDescription('🏷️ Change a member\'s nickname')
      .setDefaultMemberPermissions(PermissionFlagsBits.ChangeNickname)
      .addUserOption(o => o.setName('user').setDescription('Member whose nickname to change').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('New nickname (leave empty to reset to username)').setMaxLength(32)),
    async run(i) {
      const member = await i.options.getMember('user');
      if (!member) return err(i, 'That user isn\'t in this server.');

      const newNick = i.options.getString('nickname');
      const changed = await member.setNickname(newNick ?? null, `Changed by ${i.user.tag}`).catch(() => null);
      if (!changed) return err(i, 'I can\'t change that member\'s nickname — my role is too low.');

      return i.reply({ content: `🏷️ Nickname for ${member} is now **${changed.displayName}**.`, ephemeral: true });
    },
  },

  /* 24. /dm */
  {
    data: new SlashCommandBuilder()
      .setName('dm')
      .setDescription('✉️ DM a member as the bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(o => o.setName('user').setDescription('Member to message').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(2000)),
    async run(i) {
      const user = i.options.getUser('user');
      const message = i.options.getString('message');
      const sent = await user.send(message).then(() => true).catch(() => false);

      const result = sent
        ? `✉️ Delivered to **${user.tag}**.`
        : `⚠️ Couldn't DM **${user.tag}** (DMs closed).`;
      return i.reply({ content: result, ephemeral: true });
    },
  },

  /* ══════════════════════ INFO ══════════════════════ */

  /* 25. /serverinfo */
  {
    data: new SlashCommandBuilder()
      .setName('serverinfo')
      .setDescription('🏠 Detailed server information'),
    async run(i) {
      const g = i.guild;

      const infoEmbed = new EmbedBuilder()
        .setTitle(`🏠 ${g.name}`)
        .setThumbnail(g.iconURL({ size: 256 }))
        .setDescription([
          `**» Owner** <@${g.ownerId}>`,
          `**» Members** ${g.memberCount}`,
          `**» Created** <t:${Math.floor(g.createdTimestamp / 1000)}:R>`,
          `**» Boosts** ${g.premiumSubscriptionCount ?? 0} (level ${g.premiumTier})`,
          `**» Roles** ${g.roles.cache.size}`,
          `**» Channels** ${g.channels.cache.size}`,
          `**» ID** \`${g.id}\``,
        ].join('\n'))
        .setColor(colors.main);

      return i.reply({ embeds: [infoEmbed] });
    },
  },

  /* 26. /userinfo */
  {
    data: new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('👤 Detailed user information')
      .addUserOption(o => o.setName('user').setDescription('Member to look up (defaults to you)')),
    async run(i) {
      const user = i.options.getUser('user') ?? i.user;
      const member = await i.guild.members.fetch(user.id).catch(() => null);

      const lines = [
        `**» ID** \`${user.id}\``,
        `**» Account created** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
      ];
      if (member) {
        lines.push(`**» Joined server** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`);
        const roles = member.roles.cache
          .filter(r => r.id !== i.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => `${r}`);
        lines.push(`**» Roles** ${roles.join(' ') || '*none*'}`);
        lines.push(`**» Highest role** ${member.roles.highest}`);
        if (member.premiumSince) {
          lines.push(`**» Boosting since** <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`);
        }
      }

      const userEmbed = new EmbedBuilder()
        .setTitle(`👤 ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(lines.join('\n'))
        .setColor(colors.main);

      return i.reply({ embeds: [userEmbed] });
    },
  },

  /* 27. /roleinfo */
  {
    data: new SlashCommandBuilder()
      .setName('roleinfo')
      .setDescription('🏷️ Detailed role information')
      .addRoleOption(o => o.setName('role').setDescription('Role to inspect').setRequired(true)),
    async run(i) {
      const role = i.options.getRole('role');

      const roleEmbed = new EmbedBuilder()
        .setTitle(`🏷️ ${role.name}`)
        .setDescription([
          `**» ID** \`${role.id}\``,
          `**» Color** \`${role.hexColor}\``,
          `**» Position** ${role.position}`,
          `**» Members** ${role.members.size}`,
          `**» Hoisted** ${role.hoist ? '✅' : '❌'}`,
          `**» Mentionable** ${role.mentionable ? '✅' : '❌'}`,
          `**» Managed** ${role.managed ? '✅ (integration)' : '❌'}`,
          `**» Created** <t:${Math.floor(role.createdTimestamp / 1000)}:R>`,
        ].join('\n'))
        .setColor(role.color || colors.main);

      return i.reply({ embeds: [roleEmbed] });
    },
  },

  /* 28. /avatar */
  {
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('🖼️ Show a user\'s avatar in full size')
      .addUserOption(o => o.setName('user').setDescription('User (defaults to you)')),
    async run(i) {
      const user = i.options.getUser('user') ?? i.user;

      const avatarEmbed = new EmbedBuilder()
        .setTitle(`🖼️ ${user.tag}'s avatar`)
        .setImage(user.displayAvatarURL({ size: 1024 }))
        .setColor(colors.main);

      return i.reply({ embeds: [avatarEmbed] });
    },
  },

  /* 29. /userbanner */
  {
    data: new SlashCommandBuilder()
      .setName('userbanner')
      .setDescription('🖼️ Show a user\'s profile banner')
      .addUserOption(o => o.setName('user').setDescription('User (defaults to you)')),
    async run(i) {
      const target = i.options.getUser('user') ?? i.user;
      const user = await target.fetch(true);
      if (!user.bannerURL()) return err(i, 'They have no banner set.');

      const bannerEmbed = new EmbedBuilder()
        .setTitle(`🖼️ ${user.tag}'s banner`)
        .setImage(user.bannerURL({ size: 1024 }))
        .setColor(colors.main);

      return i.reply({ embeds: [bannerEmbed] });
    },
  },

  /* 30. /servericon */
  {
    data: new SlashCommandBuilder()
      .setName('servericon')
      .setDescription('🖼️ Show the server icon in full size'),
    run(i) {
      const icon = i.guild.iconURL({ size: 1024 });
      if (!icon) return err(i, 'This server has no icon set.');

      const iconEmbed = new EmbedBuilder()
        .setTitle(`🖼️ ${i.guild.name}'s icon`)
        .setImage(icon)
        .setColor(colors.main);

      return i.reply({ embeds: [iconEmbed] });
    },
  },

  /* 31. /serverbanner */
  {
    data: new SlashCommandBuilder()
      .setName('serverbanner')
      .setDescription('🖼️ Show the server banner in full size'),
    run(i) {
      const banner = i.guild.bannerURL({ size: 1024 });
      if (!banner) return err(i, 'This server has no banner set.');

      const bannerEmbed = new EmbedBuilder()
        .setTitle(`🖼️ ${i.guild.name}'s banner`)
        .setImage(banner)
        .setColor(colors.main);

      return i.reply({ embeds: [bannerEmbed] });
    },
  },

  /* 32. /membercount */
  {
    data: new SlashCommandBuilder()
      .setName('membercount')
      .setDescription('👥 Detailed member statistics (humans, bots, online, boosts)'),
    async run(i) {
      await i.deferReply();
      await i.guild.members.fetch().catch(() => {});
      const embed = mcEmbed(i.guild);
      return i.editReply({ embeds: [embed], components: [mcRows()] });
    },
    async onButton(i) {
      await i.guild.members.fetch().catch(() => {});
      const embed = mcEmbed(i.guild);
      return i.update({ embeds: [embed], components: [mcRows()] });
    },
  },

  /* 33. /emojilist */
  {
    data: new SlashCommandBuilder()
      .setName('emojilist')
      .setDescription('😀 List all custom emojis in the server'),
    run(i) {
      const emojis = i.guild.emojis.cache;
      if (!emojis.size) return err(i, 'This server has no custom emojis.');

      const list = emojis.map(e => `${e} \`:${e.name}:\``).join('\n').slice(0, 4000);
      const listEmbed = new EmbedBuilder()
        .setTitle(`😀 Emojis (${emojis.size})`)
        .setDescription(list)
        .setColor(colors.main);

      return i.reply({ embeds: [listEmbed], ephemeral: true });
    },
  },

  /* 34. /stickerlist */
  {
    data: new SlashCommandBuilder()
      .setName('stickerlist')
      .setDescription('🏷️ List all stickers in the server'),
    run(i) {
      const stickers = i.guild.stickers.cache;
      if (!stickers.size) return err(i, 'This server has no stickers.');

      const list = stickers.map(s => `**${s.name}** — ${s.description ?? '*no description*'}`).join('\n').slice(0, 4000);
      const listEmbed = new EmbedBuilder()
        .setTitle(`🏷️ Stickers (${stickers.size})`)
        .setDescription(list)
        .setColor(colors.main);

      return i.reply({ embeds: [listEmbed], ephemeral: true });
    },
  },

  /* 35. /botinfo */
  {
    data: new SlashCommandBuilder()
      .setName('botinfo')
      .setDescription('🤖 Bot information and health'),
    run(i, c) {
      const up = Math.floor(process.uptime());
      const days = Math.floor(up / 86400);
      const hours = Math.floor((up % 86400) / 3600);
      const mins = Math.floor((up % 3600) / 60);

      const botEmbed = new EmbedBuilder()
        .setTitle(`🤖 ${c.client.user.username}`)
        .setThumbnail(c.client.user.displayAvatarURL({ size: 256 }))
        .setDescription([
          `**» Servers** ${c.client.guilds.cache.size}`,
          `**» Uptime** \`${days}d ${hours}h ${mins}m\``,
          `**» Memory** ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MB`,
          `**» Websocket ping** ${Math.round(c.client.ws.ping)}ms`,
          `**» discord.js** v${require('discord.js').version}`,
          `**» Node** ${process.version}`,
        ].join('\n'))
        .setColor(colors.ok);

      return i.reply({ embeds: [botEmbed] });
    },
  },

  /* 36. /stats */
  {
    data: new SlashCommandBuilder()
      .setName('stats')
      .setDescription('📊 Live server statistics'),
    async run(i) {
      const g = i.guild;
      const members = await g.members.fetch().catch(() => new Map());

      const textCount = g.channels.cache.filter(ch => ch.type === ChannelType.GuildText).size;
      const voiceCount = g.channels.cache.filter(ch => ch.type === ChannelType.GuildVoice).size;
      const catCount = g.channels.cache.filter(ch => ch.type === ChannelType.GuildCategory).size;
      const online = members.filter(m => m.presence && m.presence.status !== 'offline').size;

      const statsEmbed = new EmbedBuilder()
        .setTitle(`📊 ${g.name}`)
        .setThumbnail(g.iconURL({ size: 128 }))
        .setDescription([
          `**» Members** ${members.size} (${online} online)`,
          `**» Roles** ${g.roles.cache.size}`,
          `**» Text** ${textCount} · **Voice** ${voiceCount} · **Categories** ${catCount}`,
          `**» Boost level** ${g.premiumTier} (${g.premiumSubscriptionCount ?? 0} boosts)`,
          `**» Created** <t:${Math.floor(g.createdTimestamp / 1000)}:R>`,
        ].join('\n'))
        .setColor(colors.main)
        .setTimestamp();

      return i.reply({ embeds: [statsEmbed] });
    },
  },

  /* 37. /boosts */
  {
    data: new SlashCommandBuilder()
      .setName('boosts')
      .setDescription('🚀 Server boost status'),
    run(i) {
      const g = i.guild;
      const count = g.premiumSubscriptionCount ?? 0;
      const needed = g.premiumTier === 0 ? 7 : g.premiumTier === 1 ? 14 : g.premiumTier === 2 ? 14 : 0;
      const nextLine = g.premiumTier >= 3
        ? '**» Max tier reached! 🏆**'
        : `**» Next tier at** ${needed} boosts (${needed - count} more needed)`;

      const boostEmbed = new EmbedBuilder()
        .setTitle('🚀 Boosts')
        .setDescription([
          `**» Count** ${count}`,
          `**» Level** ${g.premiumTier}`,
          nextLine,
        ].join('\n'))
        .setColor(colors.pink);

      return i.reply({ embeds: [boostEmbed] });
    },
  },

  /* 38. /channelinfo */
  {
    data: new SlashCommandBuilder()
      .setName('channelinfo')
      .setDescription('📺 Info about a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to inspect (defaults to this one)')),
    run(i) {
      const ch = i.options.getChannel('channel') ?? i.channel;

      const lines = [
        `**» ID** \`${ch.id}\``,
        `**» Type** ${ch.type}`,
        `**» Created** <t:${Math.floor(ch.createdTimestamp / 1000)}:R>`,
      ];
      if (ch.topic) lines.push(`**» Topic** ${ch.topic}`);
      if (ch.parent) lines.push(`**» Category** ${ch.parent.name}`);

      const chEmbed = new EmbedBuilder()
        .setTitle(`📺 #${ch.name}`)
        .setDescription(lines.join('\n'))
        .setColor(colors.main);

      return i.reply({ embeds: [chEmbed] });
    },
  },

  /* 39. /snipe */
  {
    data: new SlashCommandBuilder()
      .setName('snipe')
      .setDescription('🎯 Show the last deleted message in this channel'),
    run(i, c) {
      const snipe = c.snipes.get(i.channel.id);
      if (!snipe) return err(i, 'Nothing to snipe.');

      const snipeEmbed = new EmbedBuilder()
        .setAuthor({ name: snipe.author, iconURL: snipe.avatar })
        .setDescription(snipe.content || '*media only*')
        .setFooter({ text: 'Deleted message' })
        .setColor(colors.main);
      if (snipe.image) snipeEmbed.setImage(snipe.image);
      if (snipe.at) snipeEmbed.setTimestamp(snipe.at);

      return i.reply({ embeds: [snipeEmbed], ephemeral: true });
    },
  },

  /* 40. /editsnipe */
  {
    data: new SlashCommandBuilder()
      .setName('editsnipe')
      .setDescription('✏️ Show the last edited message in this channel'),
    run(i, c) {
      const snipe = c.editSnipes.get(i.channel.id);
      if (!snipe) return err(i, 'Nothing to snipe.');

      const snipeEmbed = new EmbedBuilder()
        .setAuthor({ name: snipe.author, iconURL: snipe.avatar })
        .setDescription(`**Before:** ${snipe.before || '*nothing*'}\n**After:** ${snipe.after || '*nothing*'}`)
        .setColor(colors.warn);
      if (snipe.at) snipeEmbed.setTimestamp(snipe.at);

      return i.reply({ embeds: [snipeEmbed], ephemeral: true });
    },
  },

  /* 41. /afk */
  {
    data: new SlashCommandBuilder()
      .setName('afk')
      .setDescription('😴 Set or clear your AFK status')
      .addStringOption(o => o.setName('status').setDescription('AFK reason (leave empty to clear)').setMaxLength(200)),
    async run(i, c) {
      const status = i.options.getString('status');
      const store = c.guild(i.guild.id);

      if (status) {
        store.afk[i.user.id] = status;
        c.save();
        return i.reply({ content: `😴 AFK set: *${status}*\nI'll mention it when someone pings you.`, ephemeral: true });
      }

      delete store.afk[i.user.id];
      c.save();
      return i.reply({ content: '☀️ Welcome back! AFK cleared.', ephemeral: true });
    },
  },

  /* ══════════════════════ UTILITY ══════════════════════ */

  /* 42. /embed */
  {
    data: new SlashCommandBuilder()
      .setName('embed')
      .setDescription('🧱 Build a custom embed with buttons')
      .addChannelOption(o => o.setName('channel').setDescription('Where to post the finished embed (defaults to here)').addChannelTypes(ChannelType.GuildText)),
    ns: 'eb',
    async run(i) {
      const target = i.options.getChannel('channel') ?? i.channel;
      ebData.set(i.user.id, { channelId: target.id });

      return i.reply({ embeds: [ebHead(), ebBuild(i.user.id)], components: ebRows(i.user.id), ephemeral: true });
    },
    async onButton(i) {
      const parts = i.customId.split(':');      // eb : action : userId
      const action = parts[1];
      const userId = parts[2];
      const data = ebData.get(userId) ?? {};

      if (action === 'send') {
        const target = await i.client.channels.fetch(data.channelId ?? i.channelId).catch(() => null);
        if (!target) return i.update({ content: '⚠️ Target channel no longer exists.', embeds: [], components: [] });

        await target.send({ embeds: [ebBuild(userId)] });
        ebData.delete(userId);
        return i.update({ content: `✅ **Embed sent to ${target}!**`, embeds: [], components: [] });
      }

      if (action === 'cancel') {
        ebData.delete(userId);
        return i.update({ content: '✖️ **Embed builder closed.**', embeds: [], components: [] });
      }

      const labels = {
        title: 'Title',
        description: 'Description (markdown allowed)',
        color: 'Hex, e.g. #5865F2',
        banner: 'Image URL',
        pfp: 'Thumbnail URL',
      };

      const modal = new ModalBuilder()
        .setCustomId(`eb:${action}:${userId}`)
        .setTitle('🧱 Edit Embed');

      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(action)
          .setLabel(labels[action])
          .setStyle(action === 'description' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(false)
          .setValue(data[action] ?? ''),
      ));

      return i.showModal(modal);
    },
    async onModal(i) {
      const parts = i.customId.split(':');      // eb : field : userId
      const field = parts[1];
      const userId = parts[2];
      const data = ebData.get(userId) ?? {};
      const value = i.fields.getTextInputValue(field);

      if (value) data[field] = value;
      else delete data[field];

      ebData.set(userId, data);
      return i.update({ embeds: [ebBuild(userId)], components: ebRows(userId) });
    },
  },

  /* 43. /say */
  {
    data: new SlashCommandBuilder()
      .setName('say')
      .setDescription('💬 Make the bot say something')
      .addStringOption(o => o.setName('message').setDescription('Text to send').setRequired(true).setMaxLength(2000))
      .addChannelOption(o => o.setName('channel').setDescription('Where to send it (defaults to here)').addChannelTypes(ChannelType.GuildText)),
    async run(i) {
      const target = i.options.getChannel('channel') ?? i.channel;
      const me = i.guild.members.me;
      if (!target.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
        return err(i, `I can't send messages in ${target}.`);
      }

      await target.send(i.options.getString('message'));
      return i.reply({ content: `✅ Sent to ${target}.`, ephemeral: true });
    },
  },

  /* 44. /remind */
  {
    data: new SlashCommandBuilder()
      .setName('remind')
      .setDescription('⏰ Set a reminder (sent via DM)')
      .addIntegerOption(o => o.setName('minutes').setDescription('In how many minutes').setRequired(true).setMinValue(1).setMaxValue(43200))
      .addStringOption(o => o.setName('note').setDescription('What to remind you about').setRequired(true).setMaxLength(500)),
    async run(i) {
      const minutes = i.options.getInteger('minutes');
      const note = i.options.getString('note');

      setTimeout(() => {
        i.user.send(`⏰ **Reminder:** ${note}`).catch(() => {
          i.channel.send(`⏰ <@${i.user.id}> **Reminder:** ${note}`).catch(() => {});
        });
      }, minutes * 60000);

      const at = Math.floor(Date.now() / 1000 + minutes * 60);
      return i.reply({ content: `⏰ I'll remind you in **${minutes} min** — <t:${at}:R>\n> ${note}`, ephemeral: true });
    },
  },

  /* 45. /ping */
  {
    data: new SlashCommandBuilder()
      .setName('ping')
      .setDescription('🏓 Check bot latency'),
    run(i, c) {
      const ws = Math.round(c.client.ws.ping);
      const rt = Date.now() - i.createdTimestamp;

      const pingEmbed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setDescription(`**» Websocket** ${ws}ms\n**» Roundtrip** ${rt}ms`)
        .setColor(colors.ok);

      return i.reply({ embeds: [pingEmbed], ephemeral: true });
    },
  },

  /* 46. /uptime */
  {
    data: new SlashCommandBuilder()
      .setName('uptime')
      .setDescription('⏱️ How long the bot has been up'),
    run(i) {
      const s = Math.floor(process.uptime());
      const days = Math.floor(s / 86400);
      const hours = Math.floor((s % 86400) / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = s % 60;

      const upEmbed = new EmbedBuilder()
        .setTitle('⏱️ Uptime')
        .setDescription(`\`${days}d ${hours}h ${mins}m ${secs}s\``)
        .setColor(colors.ok);

      return i.reply({ embeds: [upEmbed], ephemeral: true });
    },
  },

  /* 47. /invite */
  {
    data: new SlashCommandBuilder()
      .setName('invite')
      .setDescription('🔗 Get the bot invite link'),
    run(i, c) {
      const url = `https://discord.com/oauth2/authorize?client_id=${c.client.user.id}&permissions=8&scope=bot%20applications.commands`;

      const inviteEmbed = new EmbedBuilder()
        .setTitle('🔗 Invite Me')
        .setDescription(`[Click here to invite me](${url})`)
        .setColor(colors.main);

      return i.reply({ embeds: [inviteEmbed], ephemeral: true });
    },
  },

  /* ══════════════════════ FUN ══════════════════════ */

  /* 48. /coinflip */
  {
    data: new SlashCommandBuilder()
      .setName('coinflip')
      .setDescription('🪙 Flip a coin'),
    run(i) {
      const result = Math.random() < 0.5 ? 'Heads' : 'Tails';

      const flipEmbed = new EmbedBuilder()
        .setTitle('🪙 Coin Flip')
        .setDescription(`The coin lands on… **${result}**!`)
        .setColor(colors.warn);

      return i.reply({ embeds: [flipEmbed] });
    },
  },

  /* 49. /diceroll */
  {
    data: new SlashCommandBuilder()
      .setName('diceroll')
      .setDescription('🎲 Roll dice')
      .addIntegerOption(o => o.setName('sides').setDescription('Number of sides per die (default 6)').setMinValue(2).setMaxValue(1000))
      .addIntegerOption(o => o.setName('count').setDescription('How many dice to roll (default 1)').setMinValue(1).setMaxValue(20)),
    run(i) {
      const sides = i.options.getInteger('sides') ?? 6;
      const count = i.options.getInteger('count') ?? 1;
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((a, b) => a + b, 0);
      const shown = count > 1 ? `${rolls.join(' + ')} = **${total}**` : `**${rolls[0]}**`;

      const diceEmbed = new EmbedBuilder()
        .setTitle('🎲 Dice Roll')
        .setDescription(shown)
        .setFooter({ text: `${count}d${sides}` })
        .setColor(colors.main);

      return i.reply({ embeds: [diceEmbed] });
    },
  },

  /* 50. /8ball */
  {
    data: new SlashCommandBuilder()
      .setName('8ball')
      .setDescription('🎱 Ask the magic 8-ball a question')
      .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(200)),
    run(i) {
      const answers = [
        'Yes ✅', 'No ❌', 'Definitely 💯', 'Never 🚫', 'Ask again later 🔄',
        'Very doubtful 😬', 'Signs point to yes 🌟', 'My sources say no 🤫',
        'Absolutely 🔥', 'Don\'t count on it 😅',
      ];
      const answer = answers[Math.floor(Math.random() * answers.length)];

      const ballEmbed = new EmbedBuilder()
        .setTitle('🎱 Magic 8-Ball')
        .setDescription(`**Q:** ${i.options.getString('question')}\n**A:** ${answer}`)
        .setColor(colors.main);

      return i.reply({ embeds: [ballEmbed] });
    },
  },

  /* 51. /choose */
  {
    data: new SlashCommandBuilder()
      .setName('choose')
      .setDescription('🤔 Let the bot choose for you')
      .addStringOption(o => o.setName('options').setDescription('Comma-separated options').setRequired(true).setMaxLength(500)),
    run(i) {
      const options = i.options.getString('options').split(',').map(s => s.trim()).filter(Boolean);
      if (options.length < 2) return err(i, 'Give me at least **2** options.');

      return i.reply(`🤔 I choose: **${options[Math.floor(Math.random() * options.length)]}**`);
    },
  },

  /* 52. /rps */
  {
    data: new SlashCommandBuilder()
      .setName('rps')
      .setDescription('✂️ Play rock, paper, scissors against the bot')
      .addStringOption(o => o.setName('choice').setDescription('Your move').setRequired(true)
        .addChoices(
          { name: 'rock', value: 'r' },
          { name: 'paper', value: 'p' },
          { name: 'scissors', value: 's' },
        )),
    run(i) {
      const names = { r: 'Rock 🪨', p: 'Paper 📄', s: 'Scissors ✂️' };
      const beats = { r: 's', p: 'r', s: 'p' };
      const bot = ['r', 'p', 's'][Math.floor(Math.random() * 3)];
      const you = i.options.getString('choice');

      let result;
      if (you === bot) result = 'It\'s a tie! 🤝';
      else if (beats[you] === bot) result = 'You win! 🎉';
      else result = 'I win! 😎';

      return i.reply({ content: `You: ${names[you]}\nMe: ${names[bot]}\n**${result}**` });
    },
  },

  /* 53. /lovecalc */
  {
    data: new SlashCommandBuilder()
      .setName('lovecalc')
      .setDescription('❤️ Test compatibility between two people')
      .addUserOption(o => o.setName('first').setDescription('First person').setRequired(true))
      .addUserOption(o => o.setName('second').setDescription('Second person').setRequired(true)),
    run(i) {
      const a = i.options.getUser('first');
      const b = i.options.getUser('second');
      const percent = Math.abs(parseInt(a.id.slice(-4)) - parseInt(b.id.slice(-4))) % 101;
      const filled = Math.ceil(percent / 20);
      const hearts = '❤️'.repeat(filled) + '🖤'.repeat(5 - filled);

      const loveEmbed = new EmbedBuilder()
        .setTitle('❤️ Love Calculator')
        .setDescription(`**${a.username}** ❤️ **${b.username}**\n\nCompatibility: **${percent}%**\n${hearts}`)
        .setColor(colors.pink);

      return i.reply({ embeds: [loveEmbed] });
    },
  },

  /* 54. /joke */
  {
    data: new SlashCommandBuilder()
      .setName('joke')
      .setDescription('😂 Random joke'),
    run(i) {
      const jokes = [
        'Why don\'t skeletons fight? They don\'t have the guts. 🦴',
        'I told my computer I needed a break — it said "no problem, I\'ll go to sleep." 💤',
        'Why did the scarecrow win an award? He was outstanding in his field. 🌾',
        'Parallel lines have so much in common. Too bad they\'ll never meet. 📏',
        'I\'m reading a book about anti-gravity. It\'s impossible to put down. 📚',
      ];

      const jokeEmbed = new EmbedBuilder()
        .setTitle('😂 Joke')
        .setDescription(jokes[Math.floor(Math.random() * jokes.length)])
        .setColor(colors.warn);

      return i.reply({ embeds: [jokeEmbed] });
    },
  },

  /* 55. /fact */
  {
    data: new SlashCommandBuilder()
      .setName('fact')
      .setDescription('🧠 Random fun fact'),
    run(i) {
      const facts = [
        'Honey never spoils — 3,000-year-old honey is still edible. 🍯',
        'Octopuses have three hearts. 🐙',
        'Bananas are berries, but strawberries aren\'t. 🍌',
        'A day on Venus is longer than its year. 🪐',
        'Sharks existed before trees. 🦈',
      ];

      const factEmbed = new EmbedBuilder()
        .setTitle('🧠 Fun Fact')
        .setDescription(facts[Math.floor(Math.random() * facts.length)])
        .setColor(colors.ok);

      return i.reply({ embeds: [factEmbed] });
    },
  },

  /* ══════════════════════ BOT / REGISTRATION ══════════════════════ */

  /* 56. /help */
  {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('📚 Browse every command by category'),
    ns: 'hp',
    run(i) {
      return i.reply({ embeds: [helpPage(0)], components: [helpRows(0)], ephemeral: true });
    },
    async onButton(i) {
      const page = parseInt(i.customId.split(':')[1], 10);
      return i.update({ embeds: [helpPage(page)], components: [helpRows(page)] });
    },
  },

  /* 57. /commands — interactive command browser with a select menu */
  {
    data: new SlashCommandBuilder()
      .setName('commands')
      .setDescription('📋 Interactive list of every command'),
    ns: 'cl',
    run(i) {
      return i.reply({ embeds: [commandsEmbed(0)], components: commandsRows(0), ephemeral: true });
    },
    async onSelect(i) {
      const page = parseInt(i.values[0], 10);
      return i.update({ embeds: [commandsEmbed(page)], components: commandsRows(page) });
    },
    async onButton(i) {
      // only the close button uses this ns with a button
      return i.update({ content: '✖️ Closed.', embeds: [], components: [] });
    },
  },

  /* 58. /refresh — fixes duplicate commands.
        Guild scope is the ONLY scope this bot registers into.
        Globals are only ever cleared (set([])), never filled. */
  {
    data: new SlashCommandBuilder()
      .setName('refresh')
      .setDescription('🔄 Fix duplicate commands & re-register instantly')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async run(i) {
      await i.deferReply({ ephemeral: true });

      const payload = commands.map(cmd => cmd.data.toJSON());

      // 1. wipe the global scope — this is where the duplicates come from
      await i.client.application.commands.set([]).catch(console.error);

      // 2. register guild commands — these update instantly
      const registered = await i.guild.commands.set(payload);

      const list = commands.map(cmd => `\`/${cmd.data.name}\``).join(' · ');
      const refreshEmbed = new EmbedBuilder()
        .setTitle('🔄 Commands Refreshed')
        .setDescription([
          `**» Registered** ${registered.size} guild commands (instant)`,
          `**» Global scope** cleared — duplicates will disappear for everyone within ~1 hour`,
          '',
          list,
        ].join('\n'))
        .setColor(colors.ok);

      return i.editReply({ embeds: [refreshEmbed] });
    },
  },
];

/* ══════════════════════ command-internal state ══════════════════════ */
const pendingPayloads = new Map();
const pendingTimers = new Map();
const pendingAnnounce = new Map();
const ebData = new Map();

/* ══════════════════════ helper functions ══════════════════════ */

function panelRows(type) {
  return [
    row(
      new ButtonBuilder().setCustomId(`cfg:${type}:channel`).setLabel('Set Channel').setEmoji('📋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cfg:${type}:message`).setLabel('Message').setEmoji('💬').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cfg:${type}:title`).setLabel('Title').setEmoji('🏷️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cfg:${type}:images`).setLabel('Images').setEmoji('🖼️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cfg:${type}:color`).setLabel('Color').setEmoji('🎨').setStyle(ButtonStyle.Primary),
    ),
    row(
      new ButtonBuilder().setCustomId(`cfg:${type}:toggle`).setLabel('Toggle').setEmoji('🔘').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cfg:${type}:test`).setLabel('Test').setEmoji('👀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cfg:${type}:reset`).setLabel('Reset').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function panelEmbed(type, cfg) {
  const emoji = type === 'welcome' ? '👋' : '🚪';
  const title = type[0].toUpperCase() + type.slice(1);
  const color = cfg.color ? parseInt(cfg.color.replace('#', ''), 16) : colors.main;

  return new EmbedBuilder()
    .setTitle(`${emoji} ${title} Configuration`)
    .setDescription([
      `**Status »** ${cfg.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
      '',
      `**» Channel** ${cfg.channelId ? `<#${cfg.channelId}>` : '*not set*'}`,
      `**» Title** ${cfg.title ?? '*default*'}`,
      `**» Message** ${cfg.message ?? '*default*'}\n> *Placeholders: \`{user}\` \`{username}\` \`{server}\` \`{membercount}\`*`,
      `**» Banner** ${cfg.banner ? 'set ✅' : '*none*'}`,
      `**» PFP** ${cfg.pfp ? 'set ✅' : '*member avatar*'}`,
      `**» Color** \`${cfg.color ?? '#5865F2'}\``,
    ].join('\n'))
    .setColor(color);
}

function testEmbed(type, cfg, member) {
  const defaultMessage = type === 'welcome' ? 'Welcome to {server}!' : '{username} left {server}.';
  const defaultTitle = type === 'welcome' ? '👋 Welcome!' : '🚪 Goodbye';
  const color = cfg.color ? parseInt(cfg.color.replace('#', ''), 16) : colors.main;

  const embed = new EmbedBuilder()
    .setTitle(cfg.title ?? defaultTitle)
    .setDescription(PH(cfg.message ?? defaultMessage, member))
    .setColor(color)
    .setTimestamp();

  embed.setThumbnail(cfg.pfp ?? member.user.displayAvatarURL());
  if (cfg.banner) embed.setImage(cfg.banner);

  return embed;
}

function arEmbed(i, c) {
  const roles = (c.guild(i.guild.id).autoroles ?? []).map(id => `<@&${id}>`).join(', ') || '*none set*';

  return new EmbedBuilder()
    .setTitle('🎭 Auto Roles')
    .setDescription(`**» Roles on join**\n${roles}\n\n*Make sure my highest role is above these!*`)
    .setColor(colors.main);
}

function arRows(i, c) {
  const roleObjects = (c.guild(i.guild.id).autoroles ?? [])
    .map(id => i.guild.roles.cache.get(id))
    .filter(Boolean);

  const options = roleObjects.length
    ? roleObjects.map(r => ({ label: r.name, value: r.id }))
    : [{ label: 'No roles yet', value: 'none', default: true }];

  return [
    row(
      new ButtonBuilder().setCustomId('ar:add').setLabel('Add Role').setEmoji('➕').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ar:clear').setLabel('Clear All').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ar:remove')
        .setPlaceholder('🎭 Remove a role…')
        .addOptions(options.slice(0, 25)),
    ),
  ];
}

function mcEmbed(g) {
  const members = g.members.cache;
  const bots = members.filter(m => m.user.bot).size;
  const humans = members.size - bots;
  const online = members.filter(m => m.presence && m.presence.status !== 'offline').size;
  const boosting = members.filter(m => m.premiumSince).size;
  const pct = members.size ? Math.round((online / members.size) * 100) : 0;
  const barSize = Math.round(pct / 10);
  const bar = '🟩'.repeat(barSize) + '⬛'.repeat(10 - barSize);

  return new EmbedBuilder()
    .setTitle(`👥 ${g.name} — Members`)
    .setThumbnail(g.iconURL({ size: 128 }))
    .setDescription([
      `**» Total** \`${members.size}\``,
      `**» Humans** \`${humans}\`  ·  **» Bots** \`${bots}\``,
      `**» Online** \`${online}\` (${pct}%)`,
      `\`[${bar}]\``,
      `**» Boosting** \`${boosting}\` (server: ${g.premiumSubscriptionCount ?? 0} boosts, level ${g.premiumTier})`,
    ].join('\n'))
    .setColor(colors.ok)
    .setFooter({ text: 'Enable Server Members & Server Presence intents for exact online counts' });
}

function mcRows() {
  return row(
    new ButtonBuilder().setCustomId('mc:refresh').setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

function ebHead() {
  return new EmbedBuilder()
    .setTitle('🧱 Embed Builder')
    .setDescription('Edit your embed with the buttons below, then press **Send**.')
    .setColor(colors.main);
}

function ebBuild(userId) {
  const d = ebData.get(userId) ?? {};
  const color = d.color ? parseInt(d.color.replace('#', ''), 16) : colors.main;

  const embed = new EmbedBuilder()
    .setTitle(d.title ?? 'Your title')
    .setDescription(d.description ?? 'Your description')
    .setColor(color)
    .setTimestamp();

  if (d.banner) embed.setImage(d.banner);
  if (d.pfp) embed.setThumbnail(d.pfp);

  return embed;
}

function ebRows(userId) {
  return [
    row(
      new ButtonBuilder().setCustomId(`eb:title:${userId}`).setLabel('Title').setEmoji('🏷️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`eb:description:${userId}`).setLabel('Description').setEmoji('📝').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`eb:color:${userId}`).setLabel('Color').setEmoji('🎨').setStyle(ButtonStyle.Primary),
    ),
    row(
      new ButtonBuilder().setCustomId(`eb:banner:${userId}`).setLabel('Banner').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`eb:pfp:${userId}`).setLabel('Thumbnail').setEmoji('🔲').setStyle(ButtonStyle.Secondary),
    ),
    row(
      new ButtonBuilder().setCustomId(`eb:send:${userId}`).setLabel('Send').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`eb:cancel:${userId}`).setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

const helpPages = [
  ['⚙️ Setup', '`/welcome` `/goodbye` `/announce` `/jointocreate` `/autorole` `/ticket` `/embed` `/refresh`'],
  ['🛡️ Moderation', '`/purge` `/slowmode` `/lock` `/unlock` `/kick` `/ban` `/unban` `/timeout` `/untimeout` `/warn` `/warnings` `/clearwarnings` `/roleadd` `/roleremove` `/nickname` `/dm`'],
  ['📊 Info', '`/serverinfo` `/userinfo` `/roleinfo` `/channelinfo` `/avatar` `/userbanner` `/servericon` `/serverbanner` `/membercount` `/emojilist` `/stickerlist` `/botinfo` `/stats` `/boosts` `/snipe` `/editsnipe` `/afk`'],
  ['🔧 Utility', '`/say` `/remind` `/poll` `/giveaway` `/ping` `/uptime` `/invite`'],
  ['🎮 Fun', '`/coinflip` `/diceroll` `/8ball` `/choose` `/rps` `/lovecalc` `/joke` `/fact`'],
];

function helpPage(index) {
  const [category, list] = helpPages[index];
  const body = list.split(' ').map(cmd => `> ${cmd}`).join('\n');

  return new EmbedBuilder()
    .setTitle(`📚 Help — ${category}`)
    .setDescription(body)
    .setColor(colors.main)
    .setFooter({ text: `Page ${index + 1} / ${helpPages.length}` });
}

function helpRows(index) {
  const buttons = helpPages.map((p, x) =>
    new ButtonBuilder()
      .setCustomId(`hp:${x}`)
      .setLabel(p[0].replace(/^\S+\s/, ''))
      .setStyle(x === index ? ButtonStyle.Success : ButtonStyle.Secondary));
  return new ActionRowBuilder().addComponents(...buttons);
}

function commandsEmbed(index) {
  const [category, list] = helpPages[index];
  const body = list.split(' ').map(cmd => `> ${cmd}`).join('\n');

  return new EmbedBuilder()
    .setTitle(`📋 Command List — ${category}`)
    .setDescription(body)
    .setColor(colors.main)
    .setFooter({ text: `Category ${index + 1} / ${helpPages.length} — pick a category from the menu` });
}

function commandsRows(index) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('cl:pick')
    .setPlaceholder('📂 Choose a category…')
    .addOptions(helpPages.map((p, x) => {
      const emojiMatch = p[0].match(/^\S+/);
      return {
        label: p[0].replace(/^\S+\s/, ''),
        value: String(x),
        default: x === index,
        emoji: emojiMatch ? emojiMatch[0] : undefined,
      };
    }));

  return [
    new ActionRowBuilder().addComponents(menu),
    row(new ButtonBuilder().setCustomId('cl:close').setLabel('Close').setEmoji('✖️').setStyle(ButtonStyle.Danger)),
  ];
}

module.exports = commands;