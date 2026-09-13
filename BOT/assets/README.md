# Assets

Drop image files the bot's code needs to read from disk here.

## Webhook avatar (`/embed`)

Save the picture you want the embed-sender webhook to use as:

```
BOT/assets/webhook-avatar.png
```

(`.jpg` also works — just update the filename in `AVATAR_PATH` near the top
of `BOT/commands.js` if you use a different extension.) If this file doesn't
exist, `/embed` still works — the webhook is just created without a custom
picture, and you can click **Recreate Webhook** after adding the image.
