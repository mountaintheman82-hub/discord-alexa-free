# Real-time Discord → Alexa listener

This optional service uses the Discord Gateway to react to new messages in one configured text channel, then sends the message text to the Alexa Notify Me API. It is separate from the existing five-minute GitHub Actions poller. The existing workflow is left intact in this branch. Do not run the listener and the scheduled poller for the same channel at the same time: their cursors are independent and the same message could trigger two notifications. After confirming the listener works, disable the poller's schedule trigger in `.github/workflows/discord-alexa.yml` but keep manual `workflow_dispatch` available. To return to polling, stop the listener and re-enable the schedule.

## Important privacy behavior

- Only messages in `DISCORD_CHANNEL_ID` are considered.
- Bot messages and webhook messages are ignored.
- The message author and message text are sent to the Notify Me service so Alexa can announce them.
- Credentials are read from environment variables and must never be committed to this repository.
- The listener has to remain online. GitHub Actions is not a persistent host for a Discord Gateway connection.

## Required configuration

Configure these as secret environment variables in the hosting service:

- `DISCORD_TOKEN`: token for your Discord bot.
- `DISCORD_CHANNEL_ID`: ID of the text channel to monitor.
- `ALEXA_ACCESS_CODE`: current access code from the Notify Me skill.

In the Discord Developer Portal, enable **Message Content Intent** for the bot. The bot also needs access to the target channel and permission to view it and read its message history. Do not share or commit the bot token or Alexa access code.

## Deploy on Railway (browser-only; hosting may cost money)

1. Make sure this branch's changes are reviewed and merged to `main` before deploying from the default branch.
2. Create/sign in to Railway and create a project/service from the GitHub repository `mountaintheman82-hub/discord-alexa-free`.
3. In the service's **Settings**, set the **Root Directory** to `/realtime-listener`. Railway should find the `Dockerfile` in that directory.
4. In the service's **Variables** tab, add the three variables above. Enter their values directly in Railway; do not put them in GitHub files or send them in chat.
5. Deploy the service and check its deployment logs. It should say `Logged in as ...; listening for new messages.`
6. Send a new human message in the configured channel. The logs should show `Alexa notification sent for a new Discord message.` and Alexa should deliver the notification.

A public GitHub repository does not mean the hosting service's environment variables are public. Still, only give the service the minimum credentials it needs. Use a fresh bot token or Notify Me code if a prior value was exposed.

## Notes

- This sends new messages after the listener starts; it does not replay old channel history on startup.
- Alexa delivery can still take some time and depends on the Notify Me service and Amazon.
- Very long messages may be shortened by notification-service or Alexa limits.
- If the listener is offline, it will not receive live events while offline. The existing GitHub Actions poller remains available as a backup.
