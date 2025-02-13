// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API_URL = process.env.API_URL;
const url = process.env.APP_URL;

const app = express();
const port = process.env.PORT || 3000;

// Парсинг JSON
app.use(express.json());

// Создаем бота
const bot = new TelegramBot(token);

// Настраиваем webhook
bot.setWebHook(`${url}/webhook/${token}`);

// Обработчик webhook
app.post(`/webhook/${token}`, (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send('Bot is running');
});

// Обработка команды /start
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

// Обработка ошибок
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});

// Запускаем единственный сервер
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Обработка завершения работы
process.on('SIGINT', () => {
    process.exit();
});

process.on('SIGTERM', () => {
    process.exit();
});