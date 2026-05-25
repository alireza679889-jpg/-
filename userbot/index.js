const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fetch = require("node-fetch");

const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION || "");

const WORKER_URL =
  "https://free-config-for-iran-232.alireza679889.workers.dev/webhook";

const CONFIG_REGEX =
  /(vless|vmess|trojan|ss|hy2|tuic):\/\/[^\s]+/gi;

(async () => {
  const client = new TelegramClient(
    stringSession,
    apiId,
    apiHash,
    {
      connectionRetries: 5,
    }
  );

  await client.start({
    phoneNumber: async () => await input.text("Phone: "),
    password: async () => await input.text("2FA Password: "),
    phoneCode: async () => await input.text("Code: "),
    onError: (err) => console.log(err),
  });

  console.log("Userbot Running");

  console.log(
    "STRING_SESSION:\n",
    client.session.save()
  );

  client.addEventHandler(async (event) => {
    try {
      const message = event.message;

      if (!message?.message) return;

      const text = message.message;

      const matches = text.match(CONFIG_REGEX);

      if (!matches || matches.length === 0) return;

      await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            text,
            chat: {
              id: message.chatId?.toString(),
              title: "userbot-source",
            },
          },
        }),
      });

      console.log("Configs Sent");
    } catch (err) {
      console.error(err);
    }
  });
})();
