require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.TG_BOT_TOKEN, { polling: false });
const parser = new Parser();

const CHANNEL = process.env.TG_CHANNEL;
const YT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

const STATE_FILE = path.join(__dirname, 'state.json');

// Load last video
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastVideoId: null };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE));
}

// Save last video
function saveState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
}

// Get thumbnail
function getThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

// Check YouTube
async function checkYouTube() {
  try {
    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`
    );

    const latest = feed.items[0];
    const videoId = latest.id.split(':').pop();

    const state = loadState();

    // First run (do NOT post old video)
    if (!state.lastVideoId) {
      state.lastVideoId = videoId;
      saveState(state);
      console.log('Initial video saved, no post');
      return;
    }

    // New video detected
    if (videoId !== state.lastVideoId) {
      const caption = `🎥 *New Video Dropped*\n\n${latest.title}\n\n👉 Watch now:\n${latest.link}`;

      await bot.sendPhoto(CHANNEL, getThumbnail(videoId), {
        caption: caption,
        parse_mode: 'Markdown',
      });

      state.lastVideoId = videoId;
      saveState(state);

      console.log('Posted new video');
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
}

// Run every 5 mins
setInterval(checkYouTube, 300000);

// Run once on start
checkYouTube();
