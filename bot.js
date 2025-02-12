// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API_URL = process.env.API_URL;

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start(.*)/, async (msg, match) => {
    const startParam = match[1].trim();
    const userId = msg.from.id;

    if (startParam.startsWith('ref_')) {
        const referrerId = startParam.substring(4);

        try {
            const response = await fetch(`${API_URL}/api/referrals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    referrerId,
                    userId,
                    userData: {
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        username: msg.from.username
                    }
                })
            });

            if (!response.ok) {
                console.error('Failed to save referral:', await response.text());
            }
        } catch (error) {
            console.error('Error saving referral:', error);
        }
    }

    bot.sendMessage(msg.from.id, 'Добро пожаловать в игру!', {
        reply_markup: {
            inline_keyboard: [[
                { text: 'Открыть игру', web_app: { url: WEBAPP_URL } }
            ]]
        }
    });
});

bot.on('error', (error) => {
    console.error('Bot error:', error);
});

console.log('Bot is running...');