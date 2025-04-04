// routes/productRoutes.js
import express from 'express';
import ProductClaim from '../models/ProductClaim.js';
import Product from '../models/Product.js';

const router = express.Router();

// Создание новой заявки на активацию продукта
router.post('/claim', async (req, res) => {
    try {
        const { userId, userData, productId } = req.body;

        // Проверка обязательных полей
        if (!userId || !productId) {
            return res.status(400).json({
                success: false,
                error: 'Отсутствуют обязательные поля: userId и productId'
            });
        }

        // Проверка существования продукта
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Продукт не найден'
            });
        }

        // Проверка на существующую заявку
        const existingClaim = await ProductClaim.findOne({
            userId,
            productId
        });

        if (existingClaim) {
            return res.json({
                success: true,
                data: existingClaim,
                message: 'Заявка уже существует'
            });
        }

        // Создание новой заявки
        const newClaim = await ProductClaim.create({
            userId,
            userData,
            productId,
            status: 'pending',
            claimData: {},
            note: ''
        });

        // Увеличение счетчика заявок в продукте
        await Product.findByIdAndUpdate(
            productId,
            { $inc: { 'stats.claims': 1 } }
        );

        // Отправка уведомления администратору (если есть Bot API)
        if (req.bot) {
            try {
                const adminId = process.env.ADMIN_TELEGRAM_ID;
                if (adminId) {
                    const message = `🎉 Новая заявка на продукт!\n\nПродукт: ${product.name}\nПользователь: ${userData.first_name} ${userData.last_name || ''} (@${userData.username || 'без имени пользователя'})`;

                    await req.bot.sendMessage(adminId, message);
                }
            } catch (notifyError) {
                console.error('Ошибка отправки уведомления:', notifyError);
                // Не прерываем выполнение, если уведомление не отправлено
            }
        }

        res.status(201).json({
            success: true,
            data: newClaim
        });
    } catch (error) {
        console.error('Ошибка создания заявки на продукт:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Получение заявок пользователя
router.get('/claims/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const claims = await ProductClaim.find({ userId });

        res.json({
            success: true,
            data: claims
        });
    } catch (error) {
        console.error('Ошибка получения заявок пользователя:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;