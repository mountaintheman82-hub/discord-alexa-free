'use strict';

const { Client, GatewayIntentBits, Events } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const accessCode = process.env.ALEXA_ACCESS_CODE;
if (!token || !channelId || !accessCode) {
  throw new Error('Set DISCORD_TOKEN, DISCORD_CHANNEL_ID, and ALEXA_ACCESS_CODE in the hosting service environment.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}; listening for new messages.`);
});

client.on(Events.MessageCreate, async message => {
  if (
    message.channelId !== channelId ||
    !message.guild ||
    message.author.bot ||
    message.webhookId
  ) return;

  const author = (message.member?.displayName || message.author.username || 'Someone').slice(0, 80);
  const body = (message.content || (message.attachments.size ? '[attachment]' : '[non-text message]'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1800);

  try {
    const response = await fetch('https://api.notifymyecho.com/v1/NotifyMe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({
        accessCode,
        title: 'Discord',
        notification: `New Discord message from ${author}: ${body}`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Alexa notification failed with HTTP ${response.status}.`);
      return;
    }

    console.log('Alexa notification sent for a new Discord message.');
  } catch (error) {
    console.error(`Alexa notification failed: ${error.message}`);
  }
});

client.on('error', error => console.error(`Discord client error: ${error.message}`));
client.login(token).catch(error => {
  console.error(`Discord login failed: ${error.message}`);
  process.exit(1);
});

process.once('SIGTERM', () => { client.destroy(); process.exit(0); });
process.once('SIGINT', () => { client.destroy(); process.exit(0); });
