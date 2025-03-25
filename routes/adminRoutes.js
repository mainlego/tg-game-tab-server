// routes/adminRoutes.js
import express from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import ProductClaim from '../models/ProductClaim.js';
import Notification from '../models/Notification.js';
import Task from '../models/Task.js';

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Настройка CORS middleware для маршрутов API
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

// Фильтр файлов (только изображения)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Разрешены только изображения!'), false);
    }
};

// Конфигурация хранилища для multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // Создаем директорию, если она не существует
        const uploadDir = path.join('/data/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Генерируем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);

        // Префикс в зависимости от типа файла
        const prefix = req.path.includes('tasks') ? 'task-' : 'product-';
        cb(null, prefix + uniqueSuffix + ext);
    }
});

// Инициализация multer
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB - увеличенный лимит
    }
});

// Middleware для обработки ошибок загрузки файлов
const handleUploadErrors = (req, res, next) => {
    return upload.single('taskImage')(req, res, (err) => {
        if (err) {
            console.error('File upload error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: 'Размер файла превышает допустимый лимит (5MB)'
                });
            }
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }
        next();
    });
};

// Middleware для обработки ошибок загрузки файлов продуктов
const handleProductUploadErrors = (req, res, next) => {
    return upload.single('productImage')(req, res, (err) => {
        if (err) {
            console.error('Product file upload error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: 'Размер файла превышает допустимый лимит (5MB)'
                });
            }
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }
        next();
    });
};

// Роуты для загрузки изображений
// Создание задания с изображением
router.post('/tasks/upload', handleUploadErrors, async (req, res) => {
    try {
        // Отладка - выводим полученные данные
        console.log('Received body:', req.body);
        console.log('Received file:', req.file ? req.file.filename : 'No file');

        // Получаем данные из запроса
        const taskData = {
            title: req.body.title,
            description: req.body.description,
            type: req.body.type || 'daily',
            reward: Number(req.body.reward) || 100,
            active: req.body.active === 'true' || req.body.active === true
        };

        // Если есть файл, добавляем его путь с правильным префиксом
        if (req.file) {
            taskData.icon = `/uploads/${req.file.filename}`;
        } else if (req.body.icon) {
            taskData.icon = req.body.icon;
        }

        // Преобразуем requirements из строки в объект
        if (req.body.requirements) {
            try {
                taskData.requirements = JSON.parse(req.body.requirements);
            } catch (e) {
                console.error('Failed to parse requirements:', e);
                taskData.requirements = { level: 1, income: 0 };
            }
        } else {
            taskData.requirements = { level: 1, income: 0 };
        }

        console.log('Final task data to create:', taskData);

        // Проверяем обязательные поля
        if (!taskData.title || !taskData.description) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${!taskData.title ? 'title' : ''} ${!taskData.description ? 'description' : ''}`
            });
        }

        // Создаем задание
        const task = await Task.create(taskData);

        res.status(201).json({ success: true, data: task });
    } catch (error) {
        console.error('Ошибка создания задания с изображением:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Обновление задания с изображением
router.put('/tasks/:id/upload', handleUploadErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const taskData = req.body;

        // Преобразуем requirements из строки в объект
        if (taskData.requirements && typeof taskData.requirements === 'string') {
            taskData.requirements = JSON.parse(taskData.requirements);
        }

        // Находим существующее задание
        const existingTask = await Task.findById(id);
        if (!existingTask) {
            return res.status(404).json({ success: false, message: 'Задание не найдено' });
        }

        // Если загружено новое изображение
        if (req.file) {
            // Удаляем старое изображение, если оно не является URL и существует
            if (existingTask.icon && !existingTask.icon.startsWith('http')) {
                // Получаем имя файла из пути
                const fileName = existingTask.icon.split('/').pop();
                const oldFilePath = path.join('/data/uploads', fileName);

                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                    console.log(`Deleted old file: ${oldFilePath}`);
                }
            }

            // Устанавливаем новый путь к изображению с префиксом
            taskData.icon = `/uploads/${req.file.filename}`;
        }

        // Обновляем задание
        const task = await Task.findByIdAndUpdate(id, taskData, { new: true });

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Ошибка обновления задания с изображением:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Создание продукта с изображением
router.post('/products/upload', handleProductUploadErrors, async (req, res) => {
    try {
        // Отладка - выводим полученные данные
        console.log('Received body:', req.body);
        console.log('Received file:', req.file ? req.file.filename : 'No file');

        // Находим максимальный order и увеличиваем на 1
        const lastProduct = await Product.findOne({}).sort({ order: -1 });
        const order = lastProduct ? lastProduct.order + 1 : 0;

        // Получаем данные из запроса
        const productData = {
            name: req.body.name,
            description: req.body.description,
            type: req.body.type || 'digital',
            requiredIncome: Number(req.body.requiredIncome) || 0,
            claimInstructions: req.body.claimInstructions || '',
            gradient: req.body.gradient || 'linear-gradient(140.83deg, rgb(111, 95, 242) 0%, rgb(73, 51, 131) 100%)',
            active: req.body.active === 'true' || req.body.active === true,
            order,
            stats: {
                claims: 0,
                completedClaims: 0,
                cancelledClaims: 0
            }
        };

        // Если есть файл, добавляем его путь с префиксом /uploads/
        if (req.file) {
            productData.image = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            productData.image = req.body.image;
        }

        console.log('Final product data to create:', productData);

        // Проверяем обязательные поля
        if (!productData.name || !productData.description) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${!productData.name ? 'name' : ''} ${!productData.description ? 'description' : ''}`
            });
        }

        // Создаем продукт
        const product = await Product.create(productData);

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        console.error('Ошибка создания продукта с изображением:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Обновление продукта с изображением
router.put('/products/:id/upload', handleProductUploadErrors, async (req, res) => {
    try {
        const { id } = req.params;
        const productData = { ...req.body };

        // Преобразуем числовые и булевы значения
        productData.requiredIncome = Number(productData.requiredIncome) || 0;
        productData.active = productData.active === 'true' || productData.active === true;

        // Находим существующий продукт
        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: 'Продукт не найден' });
        }

        // Если загружено новое изображение
        if (req.file) {
            // Удаляем старое изображение, если оно не является URL и существует
            if (existingProduct.image && !existingProduct.image.startsWith('http')) {
                // Получаем имя файла из пути
                const fileName = existingProduct.image.split('/').pop();
                const oldFilePath = path.join('/data/uploads', fileName);

                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                    console.log(`Deleted old product image: ${oldFilePath}`);
                }
            }

            // Обновляем путь к изображению с правильным префиксом
            productData.image = `/uploads/${req.file.filename}`;
        }

        // Обновляем продукт
        const product = await Product.findByIdAndUpdate(id, productData, { new: true });

        res.json({ success: true, data: product });
    } catch (error) {
        console.error('Ошибка обновления продукта с изображением:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ПОЛЬЗОВАТЕЛИ
// ============

// Получение всех пользователей
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '', sortBy = 'lastLogin', sortOrder = 'desc' } = req.query;

        // Создаем объект для фильтрации
        const filterQuery = search ? {
            $or: [
                { first_name: { $regex: search, $options: 'i' } },
                { last_name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { telegramId: { $regex: search, $options: 'i' } }
            ]
        } : {};

        // Определяем опции сортировки
        const sortOptions = {};
        sortOptions[sortBy === 'level' ? 'gameData.level.current' :
            sortBy === 'income' ? 'gameData.passiveIncome' : sortBy] =
            sortOrder === 'asc' ? 1 : -1;

        // Находим пользователей с пагинацией и фильтрацией
        const users = await User.find(filterQuery)
            .select('telegramId first_name last_name username photo_url language_code gameData lastLogin registeredAt blocked')
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        // Подсчет общего количества пользователей
        const totalUsers = await User.countDocuments(filterQuery);

        // Расчет статистики
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Подсчет активных пользователей
        const activeToday = await User.countDocuments({
            ...filterQuery,
            lastLogin: { $gte: todayStart }
        });

        // Подсчет новых пользователей за неделю
        const newThisWeek = await User.countDocuments({
            ...filterQuery,
            registeredAt: { $gte: weekAgo }
        });

        // Расчет общего дохода
        const totalIncomeResult = await User.aggregate([
            { $match: filterQuery },
            { $group: {
                    _id: null,
                    totalIncome: { $sum: '$gameData.passiveIncome' }
                }}
        ]);

        const totalIncome = totalIncomeResult[0]?.totalIncome || 0;

        // Форматирование пользователей для фронтенда
        const formattedUsers = users.map(user => ({
            id: user.telegramId,
            name: `${user.first_name} ${user.last_name || ''}`.trim(),
            username: user.username,
            photoUrl: user.photo_url,
            languageCode: user.language_code,
            level: user.gameData?.level?.current || 1,
            passiveIncome: user.gameData?.passiveIncome || 0,
            balance: user.gameData?.balance || 0,
            lastLogin: user.lastLogin,
            registeredAt: user.registeredAt,
            blocked: user.blocked || false
        }));

        // Возвращаем данные в стандартизированном формате
        res.json({
            success: true,
            data: {
                users: formattedUsers,
                pagination: {
                    currentPage: Number(page),
                    totalPages: Math.ceil(totalUsers / limit),
                    totalUsers,
                    pageSize: Number(limit)
                },
                stats: {
                    total: totalUsers,
                    activeToday,
                    newThisWeek,
                    totalIncome
                }
            }
        });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получение конкретного пользователя
router.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ telegramId: id });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Обновление пользователя
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Запрос на обновление пользователя ${id}`);

        // Проверка на валидность данных
        if (!req.body.gameData) {
            return res.status(400).json({
                success: false,
                message: 'Отсутствуют gameData в запросе'
            });
        }

        // Обновляем пользователя стратегией слияния
        const update = {};

        // Обновляем только переданные поля в gameData
        if (req.body.gameData) {
            update['gameData.balance'] = req.body.gameData.balance;
            update['gameData.passiveIncome'] = req.body.gameData.passiveIncome;

            if (req.body.gameData.level) {
                update['gameData.level.current'] = req.body.gameData.level.current;
                update['gameData.level.progress'] = req.body.gameData.level.progress;
                update['gameData.level.title'] = req.body.gameData.level.title;
            }

            // Обновляем другие поля только если они переданы
            // ...
        }

        // Обновляем lastLogin
        if (req.body.lastLogin) {
            update.lastLogin = new Date(req.body.lastLogin);
        }

        const user = await User.findOneAndUpdate(
            { telegramId: id },
            { $set: update },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Пользователь не найден'
            });
        }

        console.log(`Пользователь ${id} успешно обновлен`);
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Действия над пользователем (блокировка, сброс прогресса)
router.post('/users/actions', async (req, res) => {
    try {
        const { action, userId } = req.body;

        const user = await User.findOne({ telegramId: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
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
                return res.status(400).json({ success: false, message: 'Неизвестное действие' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Ошибка выполнения действия с пользователем:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ПРОДУКТЫ
// ========

// Получение всех заявок (последние 10) - Этот маршрут должен идти ДО :productId
router.get('/products/claims/recent', async (req, res) => {
    try {
        const claims = await ProductClaim.find({})
            .populate('productId')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({ success: true, data: claims });
    } catch (error) {
        console.error('Ошибка получения последних заявок:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получение всех продуктов
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find({}).sort({ order: 1 });

        // Обновление статистики заявок, если необходимо
        for (const product of products) {
            // Если статистика не заполнена, делаем запрос к БД
            if (!product.stats || typeof product.stats.claims === 'undefined') {
                const claimsCount = await ProductClaim.countDocuments({ productId: product._id });
                const completedCount = await ProductClaim.countDocuments({
                    productId: product._id,
                    status: 'completed'
                });
                const cancelledCount = await ProductClaim.countDocuments({
                    productId: product._id,
                    status: 'cancelled'
                });

                // Обновляем статистику в базе
                product.stats = {
                    claims: claimsCount,
                    completedClaims: completedCount,
                    cancelledClaims: cancelledCount
                };

                await product.save();
            }
        }

        res.json({ success: true, data: products });
    } catch (error) {
        console.error('Ошибка получения продуктов:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Создание нового продукта
router.post('/products', async (req, res) => {
    try {
        // Находим максимальный order и увеличиваем на 1
        const lastProduct = await Product.findOne({}).sort({ order: -1 });
        const order = lastProduct ? lastProduct.order + 1 : 0;

        const product = await Product.create({
            ...req.body,
            order,
            stats: {
                claims: 0,
                completedClaims: 0,
                cancelledClaims: 0
            }
        });

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(400).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

// Получение конкретного продукта
router.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Продукт не найден' });
        }

        res.json({ success: true, data: product });
    } catch (error) {
        console.error('Ошибка получения продукта:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Обновление продукта
router.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndUpdate(id, req.body, { new: true });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Продукт не найден' });
        }

        res.json({ success: true, data: product });
    } catch (error) {
        console.error('Ошибка обновления продукта:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Удаление продукта
router.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Продукт не найден' });
        }

        res.json({ success: true, data: {} });
    } catch (error) {
        console.error('Ошибка удаления продукта:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Изменение порядка продуктов
router.post('/products/reorder', async (req, res) => {
    try {
        const { orderedIds } = req.body;

        // Обновляем порядок для каждого продукта
        for (let i = 0; i < orderedIds.length; i++) {
            await Product.findByIdAndUpdate(orderedIds[i], { order: i });
        }

        const products = await Product.find({}).sort({ order: 1 });
        res.json({ success: true, data: products });
    } catch (error) {
        console.error('Ошибка изменения порядка продуктов:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Получение заявок на продукт
router.get('/products/:productId/claims', async (req, res) => {
    try {
        const { productId } = req.params;

        const claims = await ProductClaim.find({ productId }).populate('productId');

        res.json({ success: true, data: claims });
    } catch (error) {
        console.error('Ошибка получения заявок на продукт:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Обновление статуса заявки
router.put('/products/claims/:claimId', async (req, res) => {
    try {
        const { claimId } = req.params;
        const { status, note } = req.body;

        const claim = await ProductClaim.findByIdAndUpdate(
            claimId,
            { status, note },
            { new: true }
        ).populate('productId');

        if (!claim) {
            return res.status(404).json({ success: false, message: 'Заявка не найдена' });
        }

        // Обновляем статистику продукта
        if (status === 'completed' || status === 'cancelled') {
            const updateField = status === 'completed' ? 'stats.completedClaims' : 'stats.cancelledClaims';

            await Product.findByIdAndUpdate(
                claim.productId._id,
                { $inc: { [updateField]: 1 } }
            );
        }

        res.json({ success: true, data: claim });
    } catch (error) {
        console.error('Ошибка обновления статуса заявки:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// УВЕДОМЛЕНИЯ
// ===========

// Получение всех уведомлений
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({})
            .sort({ createdAt: -1 });

        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error('Ошибка получения уведомлений:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Получение статистики по уведомлениям
router.get('/notifications/stats', async (req, res) => {
    try {
        const stats = await Notification.aggregate([
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: '$stats.sentCount' },
                    totalRead: { $sum: '$stats.readCount' },
                    avgReadRate: {
                        $avg: {
                            $cond: [
                                { $gt: ['$stats.sentCount', 0] },
                                { $divide: ['$stats.readCount', '$stats.sentCount'] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0] || {
                totalSent: 0,
                totalRead: 0,
                avgReadRate: 0
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики уведомлений:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Получение конкретного уведомления
router.get('/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
        }

        res.json({ success: true, data: notification });
    } catch (error) {
        console.error('Ошибка получения уведомления:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Обновление уведомления
router.put('/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
        }

        // Можно обновить только черновики или запланированные уведомления
        if (notification.status === 'sent') {
            return res.status(400).json({
                success: false,
                message: 'Нельзя обновить отправленное уведомление'
            });
        }

        const updatedNotification = await Notification.findByIdAndUpdate(
            id,
            req.body,
            { new: true }
        );

        res.json({ success: true, data: updatedNotification });
    } catch (error) {
        console.error('Ошибка обновления уведомления:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Удаление уведомления
router.delete('/notifications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Уведомление не найдено' });
        }

        // Можно удалить только черновики или запланированные уведомления
        if (notification.status === 'sent') {
            return res.status(400).json({
                success: false,
                message: 'Нельзя удалить отправленное уведомление'
            });
        }

        await notification.deleteOne();
        res.json({ success: true, data: {} });
    } catch (error) {
        console.error('Ошибка удаления уведомления:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// ЗАДАНИЯ
// =======

// Получение всех заданий
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: tasks });
    } catch (error) {
        console.error('Ошибка получения заданий:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Создание нового задания
router.post('/tasks', async (req, res) => {
    try {
        const task = await Task.create(req.body);
        res.status(201).json({ success: true, data: task });
    } catch (error) {
        console.error('Ошибка создания задания:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Получение конкретного задания
router.get('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const task = await Task.findById(id);

        if (!task) {
            return res.status(404).json({ success: false, message: 'Задание не найдено' });
        }

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Ошибка получения задания:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Обновление задания
router.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const task = await Task.findByIdAndUpdate(id, req.body, { new: true });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Задание не найдено' });
        }

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Ошибка обновления задания:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Удаление задания
router.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const task = await Task.findByIdAndDelete(id);

        if (!task) {
            return res.status(404).json({ success: false, message: 'Задание не найдено' });
        }

        res.json({ success: true, data: {} });
    } catch (error) {
        console.error('Ошибка удаления задания:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

export default router;