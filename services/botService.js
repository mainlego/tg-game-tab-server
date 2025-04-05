// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dbConnect from '../lib/dbConnect.js';
import Referral from '../models/Referral.js';
import cors from 'cors';

dotenv.config();

// Конфигурация и проверка переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const API_URL = process.env.API_URL || '';
const APP_URL = process.env.APP_URL || '';
const port = process.env.PORT || 3000;

if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not defined');
    process.exit(1);
}

// Инициализация Express и WebSocket
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
    origin: process.env.WEBAPP_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Добавьте middleware для обработки ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error'
    });
});

// Хранение WebSocket подключений
const clients = new Map();

// WebSocket соединения
wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    const userId = req.url.split('=')[1]; // Получаем userId из URL

    if (userId) {
        clients.set(userId, ws);
        console.log(`Client connected: ${userId}`);

        ws.on('close', () => {
            clients.delete(userId);
            console.log(`Client disconnected: ${userId}`);
        });
    }
});

// Функции для отправки уведомлений
const sendNotificationToUser = async (userId, notification) => {
    try {
        // Отправка через WebSocket
        const ws = clients.get(userId.toString());
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'notification',
                ...notification
            }));
        }

        // Отправка через Telegram Bot
        let message = '';
        if (notification.important) {
            message += '🔔 ВАЖНО!\n\n';
        }
        message += notification.message;

        const options = {
            parse_mode: 'HTML'
        };

        if (notification.button) {
            options.reply_markup = {
                inline_keyboard: [[
                    {
                        text: notification.button.text,
                        url: notification.button.url
                    }
                ]]
            };
        }

        await bot.sendMessage(userId, message, options);
        return true;
    } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
        return false;
    }
};

// Инициализация бота
const bot = new TelegramBot(token, {
    webHook: true
});

// API маршруты
app.post(`/webhook/${token}`, async (req, res) => {
    try {
        await bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing update:', error);
        res.sendStatus(500);
    }
});

// API для отправки уведомлений
app.post('/api/notifications/send', async (req, res) => {
    try {
        const { userIds, notification } = req.body;
        const results = {
            success: 0,
            failed: 0,
            failures: []
        };

        for (const userId of userIds) {
            try {
                const success = await sendNotificationToUser(userId, notification);
                if (success) {
                    results.success++;
                } else {
                    results.failed++;
                    results.failures.push({ userId, error: 'Failed to send notification' });
                }
                // Небольшая задержка между отправками
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
                results.failed++;
                results.failures.push({ userId, error: error.message });
            }
        }

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error sending notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Обработчики команд бота
bot.onText(/\(.*)/, async (msg, match) => {
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

            const response = await fetch(`${API_URL}/api/referrals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${process.env.API_KEY}`
                },
                body: JSON.stringify({
                    referrerId,
                    userId: userId.toString(),
                    userData: {
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        username: msg.from.username,
                        language_code: msg.from.language_code
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                await sendNotificationToUser(referrerId, {
                    message: `🎉 У вас новый реферал: ${msg.from.first_name}!\nКогда он начнет играть, вы получите бонус.`,
                    important: true
                });
            }
        } catch (error) {
            console.error('Error processing referral:', error);
        }
    }

    // Отправляем приветственное сообщение
    const welcomeMessage = startParam.startsWith('ref_')
        ? 'Добро пожаловать в игру! Вы присоединились по реферальной ссылке.'
        : 'Добро пожаловать в игру!';

    await bot.sendMessage(msg.from.id, welcomeMessage, {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎮 Открыть игру',
                    web_app: {
                        url: WEBAPP_URL
                    }
                }
            ]]
        }
    });
});

// Общий обработчик сообщений
bot.on('message', (msg) => {
    console.log('Received message:', msg);
});

// Обработчики ошибок
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error);
});

// Запуск сервера
const startServer = async () => {
    try {
        await dbConnect();
        console.log('Database connected successfully');

        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            console.log('Environment variables:', {
                WEBAPP_URL: WEBAPP_URL || 'Not set',
                API_URL: API_URL || 'Not set',
                APP_URL: APP_URL || 'Not set'
            });
        });

        if (APP_URL) {
            const webhookUrl = `${APP_URL}/webhook/${token}`;
            try {
                await bot.setWebHook(webhookUrl);
                console.log('Webhook set successfully to:', webhookUrl);

                const webhookInfo = await bot.getWebHookInfo();
                console.log('Webhook info:', webhookInfo);
            } catch (error) {
                console.error('Error setting webhook:', error);
            }
        } else {
            console.warn('APP_URL is not set, webhook was not configured');
        }
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};

const gracefulShutdown = async () => {
    console.log('Received shutdown signal');
    try {
        await bot.closeWebHook();
        console.log('Webhook closed');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

console.log('Starting server...');
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});