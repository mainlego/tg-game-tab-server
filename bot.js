// bot.js - начало файла
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dbConnect from './lib/dbConnect.js';
import Notification from './models/Notification.js';
import User from './models/User.js';
import Referral from './models/Referral.js';
import cors from 'cors';

// Настройка __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения
dotenv.config({ path: path.join(__dirname, '.env') });

// Проверка и получение переменных окружения
const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    WEBAPP_URL: process.env.WEBAPP_URL,
    API_URL: process.env.API_URL,
    APP_URL: process.env.APP_URL,
    MONGODB_URI: process.env.MONGODB_URI,
    PORT: process.env.PORT || 3000
};

// Проверка обязательных переменных
const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'MONGODB_URI',
    'WEBAPP_URL',
    'API_URL',
    'APP_URL'
];

for (const envVar of requiredEnvVars) {
    if (!config[envVar]) {
        console.error(`Error: ${envVar} is not defined in environment variables`);
        console.log('Current environment variables:', process.env);
        process.exit(1);
    }
}



// Конфигурация и проверка переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API_URL = process.env.API_URL;
const APP_URL = process.env.APP_URL;
const MONGODB_URI = process.env.MONGODB_URI;
const port = process.env.PORT || 3000;

// Проверяем обязательные переменные окружения
if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not defined');
    process.exit(1);
}

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined');
    process.exit(1);
}

// Инициализация Express и WebSocket
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({
    origin: [WEBAPP_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`,
        req.body ? JSON.stringify(req.body) : '');
    next();
});

// Инициализация бота
const bot = new TelegramBot(token, { webHook: true });

// WebSocket подключения
const clients = new Map();

wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New connection');
    const userId = new URLSearchParams(req.url.slice(1)).get('userId');

    if (userId) {
        clients.set(userId, ws);
        console.log(`[WebSocket] Client connected: ${userId}`);

        ws.on('close', () => {
            clients.delete(userId);
            console.log(`[WebSocket] Client disconnected: ${userId}`);
        });

        ws.on('error', (error) => {
            console.error(`[WebSocket] Error for client ${userId}:`, error);
        });
    }
});

// Функции-помощники
const sendWebSocketNotification = (userId, notification) => {
    const ws = clients.get(userId.toString());
    if (ws && ws.readyState === 1) {
        try {
            ws.send(JSON.stringify({
                type: 'notification',
                ...notification
            }));
            return true;
        } catch (error) {
            console.error(`[WebSocket] Error sending to ${userId}:`, error);
            return false;
        }
    }
    return false;
};

const formatTelegramMessage = (message, important = false, testMode = false) => {
    let formattedMessage = '';
    if (testMode) formattedMessage += '[TEST] ';
    if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
    formattedMessage += message;
    return formattedMessage;
};

// API маршруты
app.get('/api/admin/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({})
            .sort({ createdAt: -1 });
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('[API] Error getting notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/notifications/send', async (req, res) => {
    try {
        const { type, message, important, conditions, button } = req.body;

        // Находим целевых пользователей
        let query = {};
        if (type === 'level' && conditions?.minLevel) {
            query['gameData.level.current'] = { $gte: conditions.minLevel };
        }
        if (type === 'income' && conditions?.minIncome) {
            query['gameData.passiveIncome'] = { $gte: conditions.minIncome };
        }

        const users = await User.find(query).select('telegramId');
        const userIds = users.map(user => user.telegramId);

        // Создаем уведомление
        const notification = await Notification.create({
            type,
            message,
            important,
            conditions,
            button,
            stats: {
                targetCount: userIds.length,
                sentCount: 0,
                readCount: 0,
                targetUsers: userIds
            },
            status: 'sending'
        });

        // Отправляем уведомления
        let successCount = 0;
        let failedCount = 0;
        let failures = [];

        const formattedMessage = formatTelegramMessage(message, important);
        const options = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        if (button?.text && button?.url) {
            options.reply_markup = {
                inline_keyboard: [[
                    {
                        text: button.text,
                        url: button.url
                    }
                ]]
            };
        }

        for (const userId of userIds) {
            try {
                // Отправка через Telegram
                await bot.sendMessage(userId, formattedMessage, options);

                // Отправка через WebSocket
                sendWebSocketNotification(userId, {
                    message: formattedMessage,
                    important,
                    button
                });

                successCount++;
            } catch (error) {
                console.error(`[Notification] Error sending to ${userId}:`, error);
                failedCount++;
                failures.push({ userId, error: error.message });
            }

            // Задержка между отправками
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Обновляем статистику
        await Notification.findByIdAndUpdate(notification._id, {
            'stats.sentCount': successCount,
            'stats.failedCount': failedCount,
            status: 'sent',
            sentAt: new Date()
        });

        res.json({
            success: true,
            data: {
                notificationId: notification._id,
                targetCount: userIds.length,
                successCount,
                failedCount,
                failures
            }
        });
    } catch (error) {
        console.error('[API] Error sending notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/notifications/test', async (req, res) => {
    try {
        const { message, important, button, testUserId } = req.body;

        if (!testUserId) {
            return res.status(400).json({
                success: false,
                message: 'Test user ID is required'
            });
        }

        const formattedMessage = formatTelegramMessage(message, important, true);
        const options = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        if (button?.text && button?.url) {
            options.reply_markup = {
                inline_keyboard: [[
                    {
                        text: button.text,
                        url: button.url
                    }
                ]]
            };
        }

        await bot.sendMessage(testUserId, formattedMessage, options);
        sendWebSocketNotification(testUserId, {
            message: formattedMessage,
            important,
            button
        });

        res.json({
            success: true,
            message: 'Test notification sent successfully'
        });
    } catch (error) {
        console.error('[API] Error sending test notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook для бота
app.post(`/webhook/${token}`, async (req, res) => {
    try {
        await bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('[Webhook] Error processing update:', error);
        res.sendStatus(500);
    }
});

// Команды бота
bot.onText(/\/start(.*)/, async (msg, match) => {
    const startParam = match[1].trim();
    const userId = msg.from.id;

    console.log('[Bot] Start command:', {
        param: startParam,
        user: msg.from
    });

    if (startParam.startsWith('ref_')) {
        const referrerId = startParam.substring(4);
        try {
            const referral = await Referral.create({
                referrerId,
                userId: userId.toString(),
                userData: {
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name,
                    username: msg.from.username,
                    language_code: msg.from.language_code
                }
            });

            if (referral) {
                const message = formatTelegramMessage(
                    `🎉 У вас новый реферал: ${msg.from.first_name}!\nКогда он начнет играть, вы получите бонус.`,
                    true
                );
                await bot.sendMessage(referrerId, message);
            }
        } catch (error) {
            console.error('[Bot] Error processing referral:', error);
        }
    }

    const welcomeMessage = startParam.startsWith('ref_')
        ? 'Добро пожаловать в игру! Вы присоединились по реферальной ссылке.'
        : 'Добро пожаловать в игру!';

    await bot.sendMessage(msg.from.id, welcomeMessage, {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '🎮 Открыть игру',
                    web_app: { url: WEBAPP_URL }
                }
            ]]
        }
    });
});

// Обработка ошибок бота
bot.on('error', (error) => {
    console.error('[Bot] Error:', error);
});

bot.on('webhook_error', (error) => {
    console.error('[Bot] Webhook error:', error);
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('[Server] Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error'
    });
});

// Запуск сервера
const startServer = async () => {
    try {
        // Подключение к базе данных
        await dbConnect();
        console.log('[Server] Database connected successfully');

        // Запуск HTTP сервера
        server.listen(port, () => {
            console.log(`[Server] Running on port ${port}`);
            console.log('[Server] Environment:', {
                WEBAPP_URL,
                API_URL,
                APP_URL
            });
        });

        // Настройка вебхука
        if (APP_URL) {
            const webhookUrl = `${APP_URL}/webhook/${token}`;
            await bot.setWebHook(webhookUrl);
            console.log('[Bot] Webhook set:', webhookUrl);

            const webhookInfo = await bot.getWebHookInfo();
            console.log('[Bot] Webhook info:', webhookInfo);
        } else {
            console.warn('[Bot] APP_URL not set, webhook not configured');
        }
    } catch (error) {
        console.error('[Server] Startup error:', error);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    console.log('[Server] Shutting down...');
    try {
        await bot.closeWebHook();
        server.close(() => {
            console.log('[Server] Closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('[Server] Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
    console.error('[Server] Uncaught exception:', error);
});
process.on('unhandledRejection', (error) => {
    console.error('[Server] Unhandled rejection:', error);
});

// Запуск
console.log('[Server] Starting...');
startServer().catch(error => {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
});

export default server;