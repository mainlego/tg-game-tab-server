// routes/index.js - правильная структура
import express from 'express';
import dbConnect from '../lib/dbConnect.js';
import userRoutes from './userRoutes.js';
import productRoutes from './productRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import taskRoutes from './taskRoutes.js';

const router = express.Router();

// Middleware для подключения к базе данных
router.use(async (req, res, next) => {
    await dbConnect();
    next();
});

// Подключаем маршруты
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tasks', taskRoutes);

export default router;