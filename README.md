# Free Discord → Alexa Notify Me bridge (GitHub Actions)

This project checks one Discord text channel on a schedule and forwards new human messages to the Alexa **Notify Me** skill. It runs in GitHub's cloud; your PC does **not** have to stay on. On the free plan, use a **public** repository so standard GitHub-hosted Actions runners remain free. The source code is public, but the three credentials must only be added as GitHub Actions secrets, never written into files.

## What to expect

- Checks approximately every 5 minutes (GitHub may sometimes delay or skip scheduled runs).
- One Alexa notification digest per check, not one alert per message.
- The digest includes up to the five most recent human messages, with each message shortened. Older ones are counted if several arrive between checks.
- The first run only records the current newest message as a baseline; it does not read old history aloud.
- The workflow stores only the last processed Discord message ID and a monthly heartbeat in `state.json`; it does not commit message contents or credentials.
- Messages sent by bots and webhooks are ignored.

## Setup

1. Enable the **Notify Me** Alexa skill, allow notifications, then say **“Alexa, open Notify Me”** to receive a fresh access code by email. If your old code was exposed, disable/re-enable the skill and launch it again to get a replacement.
2. In the [Discord Developer Portal](https://discord.com/developers/applications), create an application and its bot. Under **Bot**, enable **Message Content Intent**. Invite the bot to your server with permission to **View Channel** and **Read Message History** in the target channel.
3. In Discord, turn on **User Settings → Advanced → Developer Mode**. Right-click the target text channel and choose **Copy Channel ID**.
4. On [GitHub](https://github.com), create a new **public** repository. Extract this ZIP on your computer, then upload the files while keeping the `.github/workflows/discord-alexa.yml` path intact. The repository root must contain `index.js` and `state.json`.
5. In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and create these three secrets exactly:
   - `DISCORD_TOKEN` — the bot token from Discord's Developer Portal
   - `DISCORD_CHANNEL_ID` — the target channel ID
   - `ALEXA_ACCESS_CODE` — the new code from Notify Me
6. Open the repository's **Actions** tab and enable workflows if GitHub asks. Select **Discord to Alexa**, choose **Run workflow**, and run it once. This initializes the message cursor without sending old messages. The next messages should be picked up by later scheduled runs.
7. To check status, open **Actions → Discord to Alexa → latest run**. The logs show counts/status only; they should not print your tokens or message content.


## Optional reverse direction: Alexa voice → Discord

This ZIP also contains `alexa-voice-to-discord/`, an optional Alexa-hosted custom skill. It lets you say **“Alexa, open Channel Messenger”**, speak a message, and confirm it before it posts to the selected Discord channel. It does not use Zapier and does not require a PC to stay on. Follow `alexa-voice-to-discord/README.md`; use a **new** Discord webhook and enter it only in the private Alexa Developer Console code editor. The files in this public GitHub project contain only a placeholder, not your secret URL. Alexa-hosted skills have published free usage limits.

## Important security notes

- Never put the bot token or Notify Me code directly in `index.js`, the workflow YAML, or `state.json`.
- Keep the repository's secret values only in **Settings → Secrets and variables → Actions**.
- Since the repo is public, anyone can read the source code. Do not accept untrusted changes to the workflow or `index.js`; modified code running on your default branch could access repository secrets.
- GitHub's free public-repository Actions usage is used here. Do not change the repository to private without checking the current included Actions quota.

## Troubleshooting

- Discord HTTP 401: replace the bot token secret with a fresh valid token.
- Discord HTTP 403: check that the bot is in the server and can view the channel and read its history.
- Notifications omit message text: check that **Message Content Intent** is enabled in the Developer Portal and that the bot is authorized properly.
- Alexa does not notify: verify the Notify Me skill has been enabled, allowed to send notifications, and launched to obtain the current access code.
- No messages after the first run: confirm the workflow is enabled and the correct channel ID is saved in `DISCORD_CHANNEL_ID`.
