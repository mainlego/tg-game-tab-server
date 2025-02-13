// bot.js
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import express from 'express'; // Добавим express

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const API_URL = process.env.API_URL;

// Создаем express приложение
const app = express();
const port = process.env.PORT || 3000;

// Добавляем простой endpoint для проверки работоспособности
app.get('/', (req, res) => {
    res.send('Bot is running');
});

const bot = new TelegramBot(token, { polling: true });

// Остальной код бота остается без изменений...

// Запускаем express сервер
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});