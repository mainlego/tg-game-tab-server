// bot.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
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

// Проверка и инициализация конфигурации
const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    WEBAPP_URL: process.env.WEBAPP_URL,
    API_URL: process.env.API_URL,
    APP_URL: process.env.APP_URL,
    MONGODB_URI: process.env.MONGODB_URI,
    PORT: process.env.PORT || 3000
};

// Проверка обязательных переменных
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'MONGODB_URI', 'WEBAPP_URL', 'API_URL', 'APP_URL'];
for (const envVar of requiredEnvVars) {
    if (!config[envVar]) {
        console.error(`Ошибка: ${envVar} не определена в переменных окружения`);
        process.exit(1);
    }
}

// Инициализация Express и WebSocket
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Хранилище WebSocket клиентов
const clients = new Map();

// Инициализация бота
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { webHook: true });

// Настройка CORS
app.use(cors({
    origin: [config.WEBAPP_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Парсинг JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (Object.keys(req.body).length > 0) {
        console.log('Request body:', req.body);
    }
    next();
});

// Добавление бота и клиентов в объект запроса
app.use((req, res, next) => {
    req.bot = bot;
    req.clients = clients;
    next();
});

// Обработка WebSocket подключений
wss.on('connection', (ws, req) => {
    const userId = new URLSearchParams(req.url.slice(1)).get('userId');

    if (userId) {
        clients.set(userId, ws);
        console.log(`[WebSocket] Клиент подключен: ${userId}`);

        ws.on('close', () => {
            clients.delete(userId);
            console.log(`[WebSocket] Клиент отключен: ${userId}`);
        });

        ws.on('error', (error) => {
            console.error(`[WebSocket] Ошибка для клиента ${userId}:`, error);
        });
    }
});

// API маршруты
// Получение игровых настроек
app.get('/api/settings', async (req, res) => {
    try {
        const settings = {
            game: {
                maxLevel: 100,
                baseIncome: 10,
                energyRegenRate: 1,
                maxEnergy: 1000,
                levelsConfig: {
                    expMultiplier: 1.2,
                    incomeMultiplier: 1.1
                }
            },
            notifications: {
                types: ['all', 'level', 'income', 'test'],
                maxLength: 500,
                minInterval: 60
            }
        };

        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Ошибка получения настроек:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// История уведомлений
app.get('/api/admin/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({})
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Ошибка получения уведомлений:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Отправка уведомлений
app.post('/api/notifications/send', async (req, res) => {
    try {
        const { type, message, important, conditions, button } = req.body;
        console.log('Получен запрос на отправку уведомления:', req.body);

        // Поиск целевых пользователей
        let query = {};
        if (type === 'level' && conditions?.minLevel) {
            query['gameData.level.current'] = { $gte: conditions.minLevel };
        }
        if (type === 'income' && conditions?.minIncome) {
            query['gameData.passiveIncome'] = { $gte: conditions.minIncome };
        }

        const users = await User.find(query).select('telegramId');
        const userIds = users.map(user => user.telegramId);

        // Создание записи уведомления
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

        // Отправка уведомлений
        let successCount = 0;
        let failedCount = 0;
        let failures = [];

        for (const userId of userIds) {
            try {
                // Настройки сообщения Telegram
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

                // Форматирование сообщения
                let formattedMessage = '';
                if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
                formattedMessage += message;

                // Отправка через Telegram
                await bot.sendMessage(userId, formattedMessage, options);

                // Отправка через WebSocket
                const ws = clients.get(userId.toString());
                if (ws?.readyState === 1) {
                    ws.send(JSON.stringify({
                        type: 'notification',
                        message: formattedMessage,
                        important,
                        button
                    }));
                }

                successCount++;
            } catch (error) {
                console.error(`Ошибка отправки для ${userId}:`, error);
                failedCount++;
                failures.push({ userId, error: error.message });
            }

            // Задержка между отправками
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Обновление статистики уведомления
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
        console.error('Ошибка отправки уведомлений:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Тестовое уведомление
app.post('/api/notifications/test', async (req, res) => {
    try {
        const { message, important, button, testUserId } = req.body;

        if (!testUserId) {
            return res.status(400).json({
                success: false,
                error: 'Требуется ID тестового пользователя'
            });
        }

        let formattedMessage = '';
        if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
        formattedMessage += '[ТЕСТ] ' + message;

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

        const ws = clients.get(testUserId.toString());
        if (ws?.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'notification',
                message: formattedMessage,
                important,
                button
            }));
        }

        res.json({
            success: true,
            message: 'Тестовое уведомление успешно отправлено'
        });
    } catch (error) {
        console.error('Ошибка отправки тестового уведомления:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook для Telegram
app.post(`/webhook/${config.TELEGRAM_BOT_TOKEN}`, async (req, res) => {
    try {
        await bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Ошибка webhook:', error);
        res.sendStatus(500);
    }
});

// Команды бота
bot.onText(/\/start(.*)/, async (msg, match) => {
    const startParam = match[1].trim();
    const userId = msg.from.id;

    console.log('Получена команда /start:', {
        param: startParam,
        user: msg.from
    });

    try {
        // Обработка реферальной системы
        if (startParam.startsWith('ref_')) {
            const referrerId = startParam.substring(4);

            try {
                await Referral.create({
                    referrerId,
                    userId: userId.toString(),
                    userData: {
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name,
                        username: msg.from.username,
                        language_code: msg.from.language_code
                    }
                });

                // Уведомление реферера
                await bot.sendMessage(referrerId,
                    `🎉 У вас новый реферал: ${msg.from.first_name}!\nКогда он начнет играть, вы получите бонус.`
                );
            } catch (error) {
                // Если пользователь уже существует, игнорируем ошибку
                if (error.code !== 11000) {
                    console.error('Ошибка обработки реферала:', error);
                }
            }
        }

        // Создание или обновление пользователя
        await User.findOneAndUpdate(
            { telegramId: userId.toString() },
            {
                $setOnInsert: {
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name,
                    username: msg.from.username,
                    language_code: msg.from.language_code,
                    photo_url: null,
                    registeredAt: new Date()
                },
                $set: {
                    lastLogin: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // Отправка приветственного сообщения
        const welcomeMessage = startParam.startsWith('ref_')
            ? 'Добро пожаловать в игру! Вы присоединились по реферальной ссылке.'
            : 'Добро пожаловать в игру!';

        await bot.sendMessage(userId, welcomeMessage, {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🎮 Открыть игру',
                        web_app: { url: config.WEBAPP_URL }
                    }
                ]]
            }
        });
    } catch (error) {
        console.error('Ошибка обработки команды /start:', error);
        await bot.sendMessage(userId, 'Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
});

// Обработка ошибок бота
bot.on('error', (error) => {
    console.error('Ошибка бота:', error);
});

bot.on('webhook_error', (error) => {
    console.error('Ошибка webhook:', error);
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
    });
});

// Запуск сервера
const startServer = async () => {
    try {
        await dbConnect();
        console.log('База данных подключена');

        server.listen(config.PORT, () => {
            console.log(`Сервер запущен на порту ${config.PORT}`);
            console.log('Конфигурация:', {
                WEBAPP_URL: config.WEBAPP_URL,
                API_URL: config.API_URL,
                APP_URL: config.APP_URL,
                MONGODB_URI: 'Connected'
            });
        });

        if (config.APP_URL) {
            const webhookUrl = `${config.APP_URL}/webhook/${config.TELEGRAM_BOT_TOKEN}`;
            try {
                await bot.setWebHook(webhookUrl);
                console.log('Webhook установлен:', webhookUrl);

                const webhookInfo = await bot.getWebHookInfo();
                console.log('Информация о webhook:', webhookInfo);
            } catch (error) {
                console.error('Ошибка установки webhook:', error);
            }
        }
    } catch (error) {
        console.error('Ошибка запуска сервера:', error);
        process.exit(1);
    }
};

// Корректное завершение работы
const shutdown = async () => {
    console.log('Завершение работы...');
    try {
        await bot.closeWebHook();
        server.close(() => {
            console.log('Сервер остановлен');
            process.exit(0);
        });
    } catch (error) {
        console.error('Ошибка при завершении работы:', error);
        process.exit(1);
    }
};

// Обработчики процесса
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
});
process.on('unhandledRejection', (error) => {
    console.error('Необработанное отклонение промиса:', error);
});

// Запуск сервера
console.log('Запуск сервера...');
startServer().catch(error => {
    console.error('Ошибка при запуске:', error);
    process.exit(1);
});

export default server; `${config.APP_URL}/webhook/${config.TELEGRAM_BOT_TOKEN}`;
try {
    await bot.setWebHook(webhookUrl);
    console.log('Webhook установлен:', webhookUrl);

    const webhookInfo = await bot.getWebHookInfo();
    console.log('Информация о webhook:', webhookInfo);
} catch (error) {
    console.error('Ошибка установки webhook:', error);
}
}
} catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
}
};

// Корректное завершение работы
const shutdown = async () => {
    console.log('Завершение работы...');
    try {
        await bot.closeWebHook();
        server.close(() => {
            console.log('Сервер остановлен');
            process.exit(0);
        });
    } catch (error) {
        console.error('Ошибка при завершении работы:', error);
        process.exit(1);
    }
};

// Обработчики процесса
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
});
process.on('unhandledRejection', (error) => {
    console.error('Необработанное отклонение промиса:', error);
});

// Запуск сервера
console.log('Запуск сервера...');
startServer().catch(error => {
    console.error('Ошибка при запуске:', error);
    process.exit(1);
});

export default server; `${config.APP_URL}/webhook/${config.TELEGRAM_BOT_TOKEN}`;
try {
    await bot.setWebHook(webhookUrl);
    console.log('Webhook установлен:', webhookUrl);

    const webhookInfo = await bot.getWebHookInfo();
    console.log('Информация о webhook:', webhookInfo);
} catch (error) {
    console.error('Ошибка установки webhook:', error);
}
}
} catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
}
};

// Корректное завершение работы
const shutdown = async () => {
    console.log('Завершение работы...');
    try {
        await bot.closeWebHook();
        server.close(() => {
            console.log('Сервер остановлен');
            process.exit(0);
        });
    } catch (error) {
        console.error('Ошибка при завершении работы:', error);
        process.exit(1);
    }
};

// Обработчики процесса
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
    console.error('Необработанное исключение:', error);
});
process.on('unhandledRejection', (error) => {
    console.error('Необработанное отклонение промиса:', error);
});

// Запуск сервера
console.log('Запуск сервера...');
startServer().catch(error => {
    console.error('Ошибка при запуске:', error);
    process.exit(1);
});

export default server;