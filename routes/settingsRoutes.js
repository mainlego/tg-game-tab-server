// routes/settingsRoutes.js
import express from 'express';
import GameSettings from '../models/GameSettings.js';

const router = express.Router();

// Получение настроек игры
router.get('/', async (req, res) => {
    try {
        const settings = await GameSettings.getDefaultSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error getting game settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Обновление настроек игры
router.put('/', async (req, res) => {
    try {
        // Получаем настройки (создаем по умолчанию, если не существуют)
        const settings = await GameSettings.getDefaultSettings();

        // Обновляем все поля из запроса
        Object.keys(req.body).forEach(key => {
            // Не обновляем служебные поля
            if (key !== '_id' && key !== 'isDefault' && key !== '__v') {
                settings[key] = req.body[key];
            }
        });

        // Обновляем дату изменения
        settings.updatedAt = new Date();

        // Сохраняем настройки
        await settings.save();

        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error updating game settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;