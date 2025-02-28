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

app.options('*', cors()); // Обработка preflight запросов

// Настройка CORS
app.use(cors({
    origin: [
        config.WEBAPP_URL,
        'http://localhost:3000',
        'https://v0-new-project-dqi1l3eck6k.vercel.app',
        /\.vercel\.app$/ // Разрешаем все поддомены vercel.app
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// На сервере Node.js/Express
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5174');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

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
// Обработка WebSocket подключений
wss.on('connection', (ws, req) => {
    const userId = new URLSearchParams(req.url.slice(1)).get('userId');

    if (userId) {
        clients.set(userId, ws);
        console.log(`[WebSocket] Клиент подключен: ${userId}`);

        // Отправляем тестовое сообщение для проверки соединения
        ws.send(JSON.stringify({
            type: 'connection_test',
            message: 'WebSocket соединение установлено'
        }));

        ws.on('message', (message) => {
            console.log(`[WebSocket] Получено сообщение от ${userId}:`, message);
        });

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


// В bot.js добавляем новый маршрут
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({})
            .select('telegramId first_name last_name username gameData lastLogin registeredAt blocked');

        // Форматируем данные для фронтенда
        const formattedUsers = users.map(user => ({
            id: user.telegramId,
            name: `${user.first_name} ${user.last_name || ''}`.trim(),
            level: user.gameData?.level?.current || 1,
            passiveIncome: user.gameData?.passiveIncome || 0,
            balance: user.gameData?.balance || 0,
            lastLogin: user.lastLogin,
            registeredAt: user.registeredAt,
            blocked: user.blocked || false
        }));

        res.json({
            success: true,
            data: {
                users: formattedUsers
            }
        });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения пользователей'
        });
    }
});

// Добавляем маршрут для блокировки/разблокировки
app.post('/api/users/actions', async (req, res) => {
    try {
        const { action, userId } = req.body;

        const user = await User.findOne({ telegramId: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        switch (action) {
            case 'block':
                user.blocked = !user.blocked;
                await user.save();
                break;

            case 'reset':
                user.gameData = {
                    balance: 0,
                    passiveIncome: 0,
                    energy: {
                        current: 1000,
                        max: 1000,
                        regenRate: 1,
                        lastRegenTime: Date.now()
                    },
                    level: {
                        current: 1,
                        max: 10,
                        progress: 0,
                        title: 'Новичок'
                    },
                    multipliers: {
                        tapValue: 1,
                        tapMultiplier: 1,
                        incomeBoost: 1
                    },
                    investments: {
                        purchased: [],
                        activeIncome: 0,
                        lastCalculation: Date.now()
                    },
                    stats: {
                        totalClicks: 0,
                        totalEarned: 0,
                        maxPassiveIncome: 0
                    }
                };
                await user.save();
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Неверное действие'
                });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Ошибка выполнения действия:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка выполнения действия'
        });
    }
});


// В bot.js
app.put('/api/users/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const { gameData } = req.body;

        const user = await User.findOneAndUpdate(
            { telegramId: telegramId.toString() },
            {
                $set: {
                    gameData,
                    lastUpdate: new Date()
                }
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// Добавьте в bot.js

// Получение списка заданий
app.get('/api/admin/tasks', async (req, res) => {
    try {
        // Здесь будет логика получения заданий из базы данных
        // Пока возвращаем тестовые данные
        const tasks = [
            {
                id: 1,
                title: 'Ежедневное задание',
                description: 'Описание задания',
                reward: 100,
                active: true,
                completions: 0
            }
        ];

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Создание задания
app.post('/api/admin/tasks', async (req, res) => {
    try {
        const taskData = req.body;
        // Здесь будет логика создания задания в базе данных
        res.json({
            success: true,
            data: taskData
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Обновление задания
app.put('/api/admin/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const taskData = req.body;
        // Здесь будет логика обновления задания в базе данных
        res.json({
            success: true,
            data: { id, ...taskData }
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Удаление задания
app.delete('/api/admin/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Здесь будет логика удаления задания из базы данных
        res.json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});




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
        const { type, message, important, conditions } = req.body;
        console.log('Получен запрос на отправку уведомления:', req.body);

        // Поиск целевых пользователей
        let query = {};
        // Для type='all' не добавляем условия в query
        if (type !== 'all') {
            if (type === 'level' && conditions?.minLevel) {
                query['gameData.level.current'] = { $gte: conditions.minLevel };
            }
            if (type === 'income' && conditions?.minIncome) {
                query['gameData.passiveIncome'] = { $gte: conditions.minIncome };
            }
        }

        console.log('Поиск пользователей с query:', query);
        const users = await User.find(query).select('telegramId');
        console.log('Найденные пользователи:', users);

        const userIds = users.map(user => user.telegramId);
        console.log('ID пользователей для отправки:', userIds);

        // Создание записи уведомления
        const notification = await Notification.create({
            type,
            message,
            important,
            conditions,
            stats: {
                targetCount: userIds.length,
                sentCount: 0,
                readCount: 0,
                targetUsers: userIds
            },
            status: 'sending'
        });

        let successCount = 0;
        let failedCount = 0;
        let failures = [];

        // Отправка уведомлений
        for (const userId of userIds) {
            try {
                // Настройки сообщения Telegram
                const options = {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                };

                // Форматирование сообщения
                let formattedMessage = '';
                if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
                formattedMessage += message;

                // Отправка через Telegram
                console.log(`Отправка уведомления в Telegram для ${userId}`);
                await bot.sendMessage(userId, formattedMessage, options);

                // Отправка через WebSocket
                const ws = clients.get(userId.toString());
                console.log(`Проверка WebSocket для ${userId}:`, !!ws);
                if (ws?.readyState === 1) {
                    ws.send(JSON.stringify({
                        type: 'notification',
                        message: formattedMessage,
                        important
                    }));
                    console.log(`WebSocket уведомление отправлено для ${userId}`);
                } else {
                    console.log(`WebSocket недоступен для ${userId}`);
                }

                successCount++;
            } catch (error) {
                console.error(`Ошибка отправки для ${userId}:`, error);
                failedCount++;
                failures.push({ userId, error: error.message });
            }
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

    // Создание или обновление пользователя
    const userData = await User.findOneAndUpdate(
        { telegramId: userId.toString() },
        {
            $setOnInsert: {
                first_name: msg.from.first_name,
                last_name: msg.from.last_name,
                username: msg.from.username,
                language_code: msg.from.language_code,
                photo_url: null,
                registeredAt: new Date(),
                gameData: {
                    balance: 0,
                    passiveIncome: 0,
                    energy: {
                        current: 1000,
                        max: 1000,
                        regenRate: 1,
                        lastRegenTime: Date.now()
                    },
                    level: {
                        current: 1,
                        max: 10,
                        progress: 0,
                        title: 'Новичок'
                    }
                }
            },
            $set: {
                lastLogin: new Date()
            }
        },
        { upsert: true, new: true }
    );

    console.log('Пользователь сохранен/обновлен:', userData);

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

export default server;