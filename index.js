'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const ALEXA_ACCESS_CODE = process.env.ALEXA_ACCESS_CODE;
const STATE_PATH = path.join(process.cwd(), 'state.json');
const DISCORD_API = 'https://discord.com/api/v10';
const NOTIFY_ME_API = 'https://api.notifymyecho.com/v1/NotifyMe';

for (const [name, value] of Object.entries({
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID: CHANNEL_ID,
  ALEXA_ACCESS_CODE,
})) {
  if (!value) throw new Error(`Missing required GitHub Actions secret: ${name}`);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { initialized: false, lastMessageId: null, lastHeartbeatMonth: null };
    }
    throw error;
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function compareSnowflakes(a, b) {
  const left = BigInt(a.id);
  const right = BigInt(b.id);
  return left < right ? -1 : left > right ? 1 : 0;
}

async function fetchDiscordMessages(after, limit = 100) {
  const url = new URL(`${DISCORD_API}/channels/${encodeURIComponent(CHANNEL_ID)}/messages`);
  url.searchParams.set('limit', String(limit));
  if (after) url.searchParams.set('after', after);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      Accept: 'application/json',
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Discord API returned HTTP ${response.status}: ${body.slice(0, 250)}`);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('Discord returned a response that was not valid JSON.');
  }
  if (!Array.isArray(data)) throw new Error('Discord returned an unexpected message response.');
  return data;
}

async function findNewMessages(lastMessageId) {
  const collected = [];
  let cursor = lastMessageId || null;

  // Keep a run bounded. If over 1,000 messages arrive between checks, later runs continue.
  for (let page = 0; page < 10; page += 1) {
    const batch = await fetchDiscordMessages(cursor, 100);
    if (batch.length === 0) break;

    batch.sort(compareSnowflakes);
    const newestId = batch[batch.length - 1].id;
    collected.push(...batch.filter(message => !cursor || BigInt(message.id) > BigInt(cursor)));

    if (newestId === cursor || batch.length < 100) break;
    cursor = newestId;
  }

  collected.sort(compareSnowflakes);
  return collected;
}

function makeNotification(messages) {
  const shown = messages.slice(-5);
  const omitted = messages.length - shown.length;
  const lines = shown.map(message => {
    const author = message.author?.username || 'Someone';
    const text = String(
      message.content || (message.attachments?.length ? '[sent an attachment]' : '[non-text message]')
    ).replace(/\s+/g, ' ').trim().slice(0, 145);
    return `${author}: ${text}`;
  });

  const prefix = `${messages.length} new Discord message${messages.length === 1 ? '' : 's'}`;
  const omittedText = omitted > 0 ? ` (${omitted} older message${omitted === 1 ? '' : 's'} omitted)` : '';
  return `${prefix}${omittedText}. ${lines.join(' | ')}`.slice(0, 1200);
}

async function sendAlexaNotification(notification) {
  const response = await fetch(NOTIFY_ME_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify({
      accessCode: ALEXA_ACCESS_CODE,
      title: 'Discord',
      notification,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Notify Me API returned HTTP ${response.status}: ${responseText.slice(0, 250)}`);
  }
}

async function main() {
  const state = readState();
  const currentMonth = new Date().toISOString().slice(0, 7);

  // First run: establish a baseline so old channel history isn't read aloud.
  if (!state.initialized) {
    const latest = await fetchDiscordMessages(null, 1);
    latest.sort(compareSnowflakes);
    state.lastMessageId = latest.length ? latest[latest.length - 1].id : null;
    state.initialized = true;
    state.lastHeartbeatMonth = currentMonth;
    saveState(state);
    console.log('Initial setup complete. Existing messages were not sent to Alexa.');
    return;
  }

  const newMessages = await findNewMessages(state.lastMessageId);
  const newestFetchedId = newMessages.length ? newMessages[newMessages.length - 1].id : state.lastMessageId;
  const humanMessages = newMessages.filter(message => !message.author?.bot && !message.webhook_id);

  // Only advance the cursor after Notify Me succeeds, so failed notifications are retried.
  if (humanMessages.length > 0) {
    const notification = makeNotification(humanMessages);
    await sendAlexaNotification(notification);
    console.log(`Sent one Alexa digest containing ${humanMessages.length} new message(s).`);
  } else if (newMessages.length > 0) {
    console.log('New messages were only from bots/webhooks; no Alexa notification was sent.');
  } else {
    console.log('No new messages.');
  }

  if (newestFetchedId) state.lastMessageId = newestFetchedId;
  state.lastHeartbeatMonth = currentMonth;
  saveState(state);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
