// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express';

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

// Инициализация Express
const app = express();
app.use(express.json());

// Инициализация бота
const bot = new TelegramBot(token, {
    webHook: true // просто указываем что используем webhook без привязки к порту
});

// Основные обработчики маршрутов
app.get('/', (req, res) => {
    res.send('Bot is running');
});

if (req.method === 'GET' && req.query.debug === 'true') {
    const allReferrals = await Referral.find({});
    console.log('All referrals in DB:', allReferrals);
    return res.status(200).json(allReferrals);
}

app.post(`/webhook/${token}`, async (req, res) => {
    try {
        await bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing update:', error);
        res.sendStatus(500);
    }
});

// Обработчики команд бота
bot.onText(/\/start(.*)/, async (msg, match) => {
    const startParam = match[1].trim();
    const userId = msg.from.id;

    console.log('Start command received:', {
        param: startParam,
        user: msg.from
    });

    // В обработчике /start в bot.js
// В обработчике /start в bot.js
    if (startParam.startsWith('ref_')) {
        const referrerId = startParam.substring(4);

        try {
            console.log('Processing referral:', {
                referrerId,
                userId,
                userData: msg.from
            });

            // Отправляем запрос к новому API эндпоинту
            // bot.js - modify the fetch request
            const response = await fetch(`${API_URL}/api/referrals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    // Add authorization header if you have an API key
                    'Authorization': `Bearer ${process.env.API_KEY}` // Add this to your .env file
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

            const responseText = await response.text();
            console.log('API Response:', response.status, responseText);

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${responseText}`);
            }

            const result = JSON.parse(responseText);
            console.log('Referral saved:', result);

            if (result.success) {
                // Отправляем уведомление реферреру только если сохранение успешно
                await bot.sendMessage(referrerId,
                    `🎉 У вас новый реферал: ${msg.from.first_name}!\nКогда он начнет играть, вы получите бонус.`
                );
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
                        url: `${WEBAPP_URL}?tgWebAppMode=fullscreen&tgWebAppExpand=1`,
                        settings: {
                            viewport_height: '100vh',
                            header_color: '#1a1a1a',
                            is_expanded: true
                        }
                    }
                }
            ]]
        }
    });


// Общий обработчик сообщений для отладки
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

// Функция запуска сервера
const startServer = async () => {
    try {
        // Запускаем сервер
        await new Promise((resolve) => {
            const server = app.listen(port, () => {
                console.log(`Server is running on port ${port}`);
                console.log('Environment variables:', {
                    WEBAPP_URL: WEBAPP_URL || 'Not set',
                    API_URL: API_URL || 'Not set',
                    APP_URL: APP_URL || 'Not set'
                });
                resolve(server);
            });

            // Обработка ошибок сервера
            server.on('error', (error) => {
                console.error('Server error:', error);
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${port} is already in use`);
                    process.exit(1);
                }
            });
        });

        // Настраиваем webhook
        if (APP_URL) {
            const webhookUrl = `${APP_URL}/webhook/${token}`;
            try {
                await bot.setWebHook(webhookUrl);
                console.log('Webhook set successfully to:', webhookUrl);

                // Проверяем информацию о webhook
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

// Обработка завершения работы
const gracefulShutdown = async () => {
    console.log('Received shutdown signal');
    try {
        await bot.closeWebHook();
        console.log('Webhook closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Запускаем сервер
console.log('Starting server...');
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});