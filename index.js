require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.TG_BOT_TOKEN, { polling: false });
const parser = new Parser();

const CHANNEL = process.env.TG_CHANNEL;
const YT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const CHECK_INTERVAL_MS = 300000;
const TEST_LATEST_VIDEO =
  String(process.env.TEST_LATEST_VIDEO || 'false').toLowerCase() === 'true';

const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastVideoId: null };
  }

  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastVideoId: null };
  }
}

function saveState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

function getThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

function looksLikeShort(item) {
  const title = String(item?.title || '').toLowerCase();
  const link = String(item?.link || '').toLowerCase();

  return (
    title.includes('#shorts') ||
    title.startsWith('shorts') ||
    title.includes(' short ') ||
    link.includes('/shorts/')
  );
}

async function sendStartupMessage() {
  try {
    await bot.sendMessage(CHANNEL, '✅ Telegram YouTube bot is connected and running.');
    console.log('Startup message sent.');
  } catch (err) {
    console.log('Startup message failed:', err.message);
  }
}

async function postLatestVideo(item, isTest = false) {
  const videoId = item.id?.split(':').pop();

  if (!videoId) {
    console.log('No valid video ID found.');
    return;
  }

  const caption =
    `${isTest ? '🧪 Test Latest Video\n\n' : '🎥 New Video Dropped\n\n'}` +
    `${item.title}\n\n` +
    `Watch now:\n${item.link}`;

  await bot.sendPhoto(CHANNEL, getThumbnail(videoId), {
    caption,
  });

  console.log(`${isTest ? 'Test-posted' : 'Posted'} video: ${item.title}`);
}

async function checkYouTube() {
  try {
    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`
    );

    if (!feed.items || feed.items.length === 0) {
      console.log('No feed items found.');
      return;
    }

    const latest = feed.items[0];
    const videoId = latest.id?.split(':').pop();

    if (!videoId) {
      console.log('No valid video ID found.');
      return;
    }

    if (looksLikeShort(latest)) {
      console.log('Latest upload looks like a Short. Skipping.');
      return;
    }

    if (TEST_LATEST_VIDEO) {
      await postLatestVideo(latest, true);
      return;
    }

    const state = loadState();

    if (!state.lastVideoId) {
      state.lastVideoId = videoId;
      saveState(state);
      console.log('Initial video saved, no post.');
      return;
    }

    if (videoId !== state.lastVideoId) {
      await postLatestVideo(latest, false);

      state.lastVideoId = videoId;
      saveState(state);
    } else {
      console.log('No new video.');
    }
  } catch (err) {
    console.log('YouTube check failed:', err.message);
  }
}

async function start() {
  await sendStartupMessage();
  await checkYouTube();
  setInterval(checkYouTube, CHECK_INTERVAL_MS);
}

start();
