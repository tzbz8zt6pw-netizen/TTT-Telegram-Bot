require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.TG_BOT_TOKEN, { polling: false });
const parser = new Parser();

const CHANNEL = process.env.TG_CHANNEL;
const YT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://tttmarkets.com';
const CHECK_INTERVAL_MS = 300000;

const TEST_LATEST_VIDEO =
  String(process.env.TEST_LATEST_VIDEO || 'false').toLowerCase() === 'true';

const FORCE_POST_COUNT = Number(process.env.FORCE_POST_COUNT || 0);

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

async function postVideo(item, mode = 'live') {
  const videoId = item.id?.split(':').pop();

  if (!videoId) {
    console.log('No valid video ID found.');
    return;
  }

  const caption =
    `🎥 *New TTT Video on YouTube*\n\n` +
    `*${item.title}*\n\n` +
    `Fresh content just landed from TTT Markets.\n\n` +
    `Tap below to watch 👇`;

  await bot.sendPhoto(CHANNEL, getThumbnail(videoId), {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '▶️ Watch Video',
            url: item.link,
          },
        ],
        [
          {
            text: '🌐 Visit Website',
            url: WEBSITE_URL,
          },
        ],
      ],
    },
  });

  console.log(`${mode === 'force' ? 'Force-posted' : 'Posted'} video: ${item.title}`);
}

async function forcePostLatestVideos(feedItems, count) {
  const filtered = feedItems.filter(item => !looksLikeShort(item)).slice(0, count);

  if (filtered.length === 0) {
    console.log('No valid videos available to force post.');
    return;
  }

  const ordered = [...filtered].reverse();

  for (const item of ordered) {
    await postVideo(item, 'force');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`Force-posted ${ordered.length} video(s).`);
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

    const recentItems = feed.items.slice(0, 10);

    if (FORCE_POST_COUNT > 0) {
      await forcePostLatestVideos(recentItems, Math.min(FORCE_POST_COUNT, 2));
      return;
    }

    const latest = recentItems[0];
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
      await postVideo(latest, 'force');
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
      await postVideo(latest, 'live');

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
  await checkYouTube();
  setInterval(checkYouTube, CHECK_INTERVAL_MS);
}

start();
