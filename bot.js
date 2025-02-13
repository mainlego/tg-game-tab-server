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

app.use(express.json());

const bot = new TelegramBot(token);

// Устанавливаем webhook
bot.setWebHook(`${url}/webhook/${token}`);

// Обработчик webhook
app.post(`/webhook/${token}`, (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// Обработка команды /start
bot.onText(/\/start(.*)/, async (msg, match) => {
    const startParam = match[1].trim();
    const userId = msg.from.id;

    console.log('Start command received:', {
        param: startParam,
        user: msg.from
    });

    if (startParam.startsWith('ref_')) {
        const referrerId = startParam.substring(4);

        try {
            console.log('Processing referral:', {
                referrerId,
                userId,
                userData: msg.from
            });

            // Сохраняем реферала в базу данных
            const response = await fetch(`${API_URL}/api/referrals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    referrerId,
                    userId: userId.toString(), // преобразуем в строку для консистентности
                    userData: {
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        username: msg.from.username,
                        photo_url: msg.from.photo_url,
                        language_code: msg.from.language_code
                    }
                })
            });

            const result = await response.json();
            console.log('Referral saved:', result);

            // Отправляем сообщение и реферреру
            bot.sendMessage(referrerId, `У вас новый реферал: ${msg.from.first_name}!`);

        } catch (error) {
            console.error('Error saving referral:', error);
        }
    }

    // Отправляем приветственное сообщение с кнопкой для игры
    bot.sendMessage(msg.from.id, 'Добро пожаловать в игру!', {
        reply_markup: {
            inline_keyboard: [[
                { text: 'Открыть игру', web_app: { url: WEBAPP_URL } }
            ]]
        }
    });
});

app.get('/', (req, res) => {
    res.send('Bot is running');
});

// Обработка ошибок
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});

// Запускаем сервер
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('Environment:', {
        WEBAPP_URL,
        API_URL,
        APP_URL
    });
});