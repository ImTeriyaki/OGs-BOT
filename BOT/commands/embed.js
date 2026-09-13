const {
  SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, WebhookClient,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { colors, row, err } = require('./_shared');

/* webhook avatar — drop an image at this path, see BOT/assets/README.md */
const AVATAR_PATH = path.join(__dirname, '..', 'assets', 'webhook-avatar.png');
const webhookAvatar = () => (fs.existsSync(AVATAR_PATH) ? fs.readFileSync(AVATAR_PATH) : null);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('📨 Set up a webhook here, then paste JSON from an embed builder to send it')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks),
  ns: 'emb',
  async run(i, ctx) {
    const g = ctx.guild(i.guildId);
    const existing = g.embedWebhooks?.[i.channel.id];
    const embed = new EmbedBuilder()
      .setTitle('📨 Embed Sender — Setup')
      .setColor(colors.main)
      .setDescription([
        existing
          ? `A webhook already exists in ${i.channel} — you can go straight to sending an embed.`
          : `This sets up a webhook in ${i.channel} so the bot can post rich embeds here.`,
        '',
        '**How it works:**',
        '1️⃣ Click **Create Webhook** below (skip if one already exists).',
        '2️⃣ Go to **https://discohook.org** and build your embed visually.',
        '3️⃣ Use its **Share → Copy JSON** / `</>` button to copy the JSON.',
        '4️⃣ Come back here, click **Paste Embed JSON**, and paste it in.',
      ].join('\n'))
      .setFooter({ text: existing ? 'Webhook ready in this channel' : 'No webhook here yet' });
    return i.reply({
      embeds: [embed],
      components: [row(
        new ButtonBuilder().setCustomId('emb:create').setLabel(existing ? 'Recreate Webhook' : 'Create Webhook').setEmoji('🪝').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('emb:paste').setLabel('Paste Embed JSON').setEmoji('📋').setStyle(ButtonStyle.Success).setDisabled(!existing),
      )],
      ephemeral: true,
    });
  },
  async onButton(i, ctx) {
    const g = ctx.guild(i.guildId);
    const action = i.customId.split(':')[1];

    if (action === 'create') {
      if (!i.guild.members.me.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
        return err(i, 'I need the **Manage Webhooks** permission.');
      }
      const avatar = webhookAvatar();
      const webhook = await i.channel.createWebhook({
        name: 'Embed Sender',
        avatar: avatar ?? undefined,
        reason: `Embed sender set up by ${i.user.tag}`,
      }).catch(() => null);
      if (!webhook) return err(i, "I couldn't create a webhook here — check my permissions.");

      g.embedWebhooks ??= {};
      g.embedWebhooks[i.channel.id] = { id: webhook.id, token: webhook.token };
      ctx.save();

      return i.update({
        embeds: [new EmbedBuilder()
          .setTitle('✅ Webhook Created')
          .setColor(colors.good)
          .setDescription([
            `Webhook ready in ${i.channel}.`,
            avatar ? '' : "\n*No avatar image found — drop one at `BOT/assets/webhook-avatar.png` and click **Recreate Webhook** to use it.*",
            '',
            'Now go to **https://discohook.org**, build your embed, copy its JSON, then click **Paste Embed JSON**.',
          ].join('\n'))],
        components: [row(
          new ButtonBuilder().setCustomId('emb:create').setLabel('Recreate Webhook').setEmoji('🪝').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('emb:paste').setLabel('Paste Embed JSON').setEmoji('📋').setStyle(ButtonStyle.Success),
        )],
      });
    }

    if (action === 'paste') {
      if (!g.embedWebhooks?.[i.channel.id]) return err(i, 'No webhook here yet — click **Create Webhook** first.');
      const modal = new ModalBuilder().setCustomId('emb:jsonModal').setTitle('Paste Embed JSON');
      modal.addComponents(row(
        new TextInputBuilder().setCustomId('json').setLabel('JSON from discohook.org').setStyle(TextInputStyle.Paragraph).setRequired(true),
      ));
      return i.showModal(modal);
    }
  },
  async onModal(i, ctx) {
    const g = ctx.guild(i.guildId);
    const hook = g.embedWebhooks?.[i.channel.id];
    if (!hook) return err(i, 'No webhook here yet — run `/embed` again.');

    let parsed;
    try {
      parsed = JSON.parse(i.fields.getTextInputValue('json'));
    } catch {
      return err(i, "That's not valid JSON — copy the export from discohook.org exactly and try again.");
    }

    const payload = Array.isArray(parsed)
      ? { embeds: parsed }
      : parsed.embeds
        ? { content: parsed.content || undefined, embeds: parsed.embeds }
        : { embeds: [parsed] };

    if (!payload.embeds?.length && !payload.content) return err(i, 'That JSON has no `embeds` or `content` to send.');

    try {
      await new WebhookClient({ id: hook.id, token: hook.token }).send(payload);
    } catch {
      return err(i, "Couldn't send — the webhook may have been deleted. Run `/embed` and click **Create Webhook** again.");
    }
    return i.reply({ content: '✅ Sent!', ephemeral: true });
  },
};
