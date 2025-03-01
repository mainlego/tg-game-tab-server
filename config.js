// config.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Настройка __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
dotenv.config({ path: path.join(__dirname, '.env') });

// Конфигурация приложения
const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    WEBAPP_URL: process.env.WEBAPP_URL,
    API_URL: process.env.API_URL,
    APP_URL: process.env.APP_URL,
    MONGODB_URI: process.env.MONGODB_URI,
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development'
};

// Проверка наличия всех необходимых переменных
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'MONGODB_URI', 'WEBAPP_URL'];
for (const envVar of requiredEnvVars) {
    if (!config[envVar]) {
        console.error(`Ошибка: ${envVar} не определена в переменных окружения`);
        process.exit(1);
    }
}

// В режиме разработки выводим конфигурацию (с маскированием токенов)
if (config.NODE_ENV === 'development') {
    const maskedConfig = {
        ...config,
        TELEGRAM_BOT_TOKEN: config.TELEGRAM_BOT_TOKEN ? '***' + config.TELEGRAM_BOT_TOKEN.substring(config.TELEGRAM_BOT_TOKEN.length - 5) : undefined,
        MONGODB_URI: config.MONGODB_URI ? config.MONGODB_URI.replace(/:([^:@]+)@/, ':***@') : undefined,
    };
    console.log('Конфигурация:', maskedConfig);
}

export default config;