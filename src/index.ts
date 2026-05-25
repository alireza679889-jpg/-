export interface Env {
  BOT_TOKEN: string;
  TARGET_CHAT_ID: string;
  SEEN_CONFIGS: KVNamespace;
}

const CONFIG_REGEX =
  /(vless|vmess|trojan|ss|hy2|tuic):\/\/[^\s]+/gi;

function extractConfigs(text: string): string[] {
  const matches = text.match(CONFIG_REGEX);
  if (!matches) return [];
  return [...new Set(matches)];
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return [...new Uint8Array(hash)]
    .map((b) =>
      b.toString(16).padStart(2, "0")
    )
    .join("");
}

async function sendTelegramMessage(
  env: Env,
  text: string
) {
  const url =
    `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: env.TARGET_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const result = await res.text();

  console.log(result);

  return result;
}

async function processText(
  env: Env,
  text: string,
  source = "unknown"
) {
  const configs = extractConfigs(text);

  if (configs.length === 0) {
    return {
      ok: false,
      reason: "no configs",
    };
  }

  let sent = 0;

  for (const config of configs) {
    const hash = await sha256(config);

    const exists =
      await env.SEEN_CONFIGS.get(hash);

    if (exists) {
      console.log("Duplicate skipped");
      continue;
    }

    await env.SEEN_CONFIGS.put(hash, "1", {
      expirationTtl: 86400 * 30,
    });

    const protocol =
      config.split("://")[0].toUpperCase();

    const message =
`🚀 <b>NEW CONFIG</b>

📡 <b>Source:</b> ${source}
🔐 <b>Protocol:</b> ${protocol}

<code>${config}</code>`;

    await sendTelegramMessage(
      env,
      message
    );

    sent++;
  }

  return {
    ok: true,
    sent,
  };
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {

    const url = new URL(request.url);

    if (request.method === "GET") {
      return Response.json({
        ok: true,
        service: "config-bot",
      });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhook"
    ) {
      try {
        const body =
          await request.json<any>();

        console.log(
          JSON.stringify(body)
        );

        // Telegram webhook
        if (body.channel_post?.text) {
          const result =
            await processText(
              env,
              body.channel_post.text,
              body.channel_post.chat?.title ||
                "telegram-channel"
            );

          return Response.json(result);
        }

        // Userbot payload
        if (body.message?.text) {
          const result =
            await processText(
              env,
              body.message.text,
              body.message.chat?.title ||
                "userbot"
            );

          return Response.json(result);
        }

        return Response.json({
          ok: false,
          reason: "unsupported payload",
        });

      } catch (err: any) {
        return Response.json(
          {
            ok: false,
            error:
              err?.message ||
              "unknown error",
          },
          {
            status: 500,
          }
        );
      }
    }

    return new Response(
      "Not Found",
      {
        status: 404,
      }
    );
  },
};
