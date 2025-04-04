// routes/referralRoutes.js
import express from 'express';
import Referral from '../models/Referral.js';

const router = express.Router();

// Получение рефералов пользователя
router.get('/', async (req, res) => {
    console.log('Получен запрос на получение рефералов:', req.query);
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Параметр userId обязателен'
            });
        }

        // Находим все рефералы, где данный пользователь является реферером
        const referrals = await Referral.find({ referrerId: userId });
        console.log(`Найдено ${referrals.length} рефералов для пользователя ${userId}`);

        return res.status(200).json({
            success: true,
            data: referrals
        });
    } catch (error) {
        console.error('Ошибка при получении рефералов:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка сервера'
        });
    }
});

// Создание нового реферала
router.post('/', async (req, res) => {
    console.log('Получен запрос на создание реферала:', req.body);
    try {
        const { referrerId, userId, userData } = req.body;

        // Проверка обязательных полей
        if (!referrerId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'referrerId и userId обязательны'
            });
        }

        // Проверка существования реферала
        const existingReferral = await Referral.findOne({ userId });
        if (existingReferral) {
            return res.status(400).json({
                success: false,
                message: 'Пользователь уже зарегистрирован как реферал'
            });
        }

        // Создание нового реферала
        const newReferral = new Referral({
            referrerId,
            userId,
            userData: {
                first_name: userData?.first_name || '',
                last_name: userData?.last_name || '',
                username: userData?.username || '',
                language_code: userData?.language_code || '',
                photo_url: userData?.photo_url || ''
            },
            joinedAt: new Date(),
            rewardClaimed: false
        });

        await newReferral.save();
        console.log('Создан новый реферал:', newReferral);

        // Уведомляем реферера через Telegram (если возможно)
        if (req.bot) {
            try {
                await req.bot.sendMessage(
                    referrerId,
                    `🎉 У вас новый реферал: ${userData?.first_name || 'Новый пользователь'}!\nКогда он начнет играть, вы получите бонус.`
                );
            } catch (error) {
                console.error('Ошибка при отправке уведомления:', error);
                // Продолжаем выполнение даже при ошибке отправки уведомления
            }
        }

        return res.status(201).json({
            success: true,
            data: newReferral
        });
    } catch (error) {
        console.error('Ошибка при создании реферала:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка сервера'
        });
    }
});

// Обновление реферала (для отметки полученной награды)
router.put('/:id', async (req, res) => {
    console.log(`Получен запрос на обновление реферала ${req.params.id}:`, req.body);
    try {
        const { id } = req.params;
        const { rewardClaimed } = req.body;

        if (rewardClaimed === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Необходимо указать rewardClaimed'
            });
        }

        const updatedReferral = await Referral.findByIdAndUpdate(
            id,
            { rewardClaimed },
            { new: true }
        );

        if (!updatedReferral) {
            return res.status(404).json({
                success: false,
                message: 'Реферал не найден'
            });
        }

        return res.status(200).json({
            success: true,
            data: updatedReferral
        });
    } catch (error) {
        console.error('Ошибка при обновлении реферала:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка сервера'
        });
    }
});

export default router;