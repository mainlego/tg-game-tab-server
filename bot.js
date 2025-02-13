// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express';
import axios from 'axios'; // Добавьте эту зависимость


// Включим более подробное логирование
console.log('Bot starting...');
console.log('Environment variables:', {
    WEBAPP_URL: process.env.WEBAPP_URL,
    API_URL: process.env.API_URL,
    APP_URL: process.env.APP_URL
});

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


bot.on('message', async (msg) => {
    console.log('Received message:', JSON.stringify(msg, null, 2));
});

// Обработка команды /start
bot.onText(/\/start(.*)/, async (msg, match) => {
    try {
        console.log('Start command received:', {
            message: msg,
            match: match
        });

        const startParam = match[1].trim();
        if (startParam.startsWith('ref_')) {
            // Проверяем формат и значения
            console.log('Referral params:', {
                startParam,
                userId: msg.from.id,
                referrerId: startParam.substring(4)
            });

            // Пробуем отправить запрос через axios для лучшей отладки
            const response = await axios.post(`${API_URL}/api/referrals`, {
                referrerId: startParam.substring(4),
                userId: msg.from.id,
                userData: {
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name,
                    username: msg.from.username
                }
            });

            console.log('API Response:', response.data);
        }
    } catch (error) {
        console.error('Error in start handler:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
    }
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