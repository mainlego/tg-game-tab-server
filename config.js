// config.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    WEBAPP_URL: process.env.WEBAPP_URL,
    API_URL: process.env.API_URL,
    APP_URL: process.env.APP_URL,
    MONGODB_URI: process.env.MONGODB_URI,
    PORT: process.env.PORT || 3000
};

// Проверка наличия всех необходимых переменных
Object.entries(config).forEach(([key, value]) => {
    if (!value && key !== 'PORT') {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

export default config;