// routes/userRoutes.js
import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Базовый маршрут для проверки работы
router.get('/', async (req, res) => {
    try {
        res.json({ success: true, message: 'User API is working' });
    } catch (error) {
        console.error('Error in user route:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;