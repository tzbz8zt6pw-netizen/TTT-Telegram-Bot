require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TG_BOT_TOKEN, { polling: false });

async function run() {
  try {
    await bot.sendMessage(
      process.env.TG_CHANNEL,
      '🚀 Telegram bot is connected and working.'
    );
    console.log('Test message sent successfully.');
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
  }
}

run();
