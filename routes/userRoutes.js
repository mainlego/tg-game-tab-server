// routes/userRoutes.js
import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Basic user endpoint
router.get('/', async (req, res) => {
    try {
        res.json({ success: true, message: 'User API is working' });
    } catch (error) {
        console.error('Error in user route:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ telegramId: id });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;