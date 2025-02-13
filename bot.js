// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const API_URL = process.env.API_URL || '';
const APP_URL = process.env.APP_URL || '';

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not defined');
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Создаем бота с правильными опциями для webhook
const bot = new TelegramBot(token, {
    webHook: {
        port: port
    }
});

// Настраиваем webhook
if (APP_URL) {
    const webhookUrl = `${APP_URL}/webhook/${token}`;
    bot.setWebHook(webhookUrl).then(() => {
        console.log('Webhook set to:', webhookUrl);
    }).catch(error => {
        console.error('Error setting webhook:', error);
    });
}

// Обработчик webhook
app.post(`/webhook/${token}`, async (req, res) => {
    try {
        await bot.processUpdate(req.body); // Используем processUpdate вместо handleUpdate
        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing update:', error);
        res.sendStatus(500);
    }
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
            if (!API_URL) {
                throw new Error('API_URL is not defined');
            }

            console.log('Processing referral:', {
                referrerId,
                userId,
                userData: msg.from
            });

            // Сохраняем реферала
            const response = await fetch(`${API_URL}/api/referrals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    referrerId,
                    userId: userId.toString(),
                    userData: {
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        username: msg.from.username
                    }
                })
            });

            const result = await response.json();
            console.log('Referral saved:', result);

            // Отправляем уведомление реферреру
            bot.sendMessage(referrerId, `У вас новый реферал: ${msg.from.first_name}!`);

        } catch (error) {
            console.error('Error saving referral:', error);
        }
    }

    // Отправляем приветственное сообщение
    const welcomeMessage = 'Добро пожаловать в игру!';
    const keyboard = WEBAPP_URL ? {
        reply_markup: {
            inline_keyboard: [[
                { text: 'Открыть игру', web_app: { url: WEBAPP_URL } }
            ]]
        }
    } : undefined;

    bot.sendMessage(msg.from.id, welcomeMessage, keyboard);
});

// Добавляем общий обработчик сообщений для отладки
bot.on('message', (msg) => {
    console.log('Received message:', msg);
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
    console.log('Environment variables:', {
        WEBAPP_URL: WEBAPP_URL || 'Not set',
        API_URL: API_URL || 'Not set',
        APP_URL: APP_URL || 'Not set'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    bot.closeWebHook();
    process.exit();
});

process.on('SIGTERM', () => {
    bot.closeWebHook();
    process.exit();
});