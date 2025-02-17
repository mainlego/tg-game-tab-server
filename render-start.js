// render-start.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Загружаем переменные окружения из process.env
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
process.env.WEBAPP_URL = process.env.WEBAPP_URL;
process.env.API_URL = process.env.API_URL;
process.env.APP_URL = process.env.APP_URL;
process.env.MONGODB_URI = process.env.MONGODB_URI;
process.env.PORT = process.env.PORT || 3000;

// Запускаем бота
import('./bot.js').catch(err => {
    console.error('Error starting bot:', err);
    process.exit(1);
});