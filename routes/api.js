// routes/api.js
import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

// Game Settings
router.get('/settings', async (req, res) => {
    try {
        // You can modify these default settings as needed
        const settings = {
            game: {
                maxLevel: 100,
                baseIncome: 10,
                energyRegenRate: 1,
                maxEnergy: 1000,
                levelsConfig: {
                    expMultiplier: 1.2,
                    incomeMultiplier: 1.1
                }
            },
            notifications: {
                types: ['all', 'level', 'income', 'test'],
                maxLength: 500,
                minInterval: 60 // seconds
            }
        };

        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get notifications history
router.get('/admin/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find({})
            .sort({ createdAt: -1 })
            .limit(100); // Limit to last 100 notifications

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send notification
router.post('/notifications/send', async (req, res) => {
    try {
        const { type, message, important, conditions, button } = req.body;
        console.log('Received notification request:', req.body);

        // Find target users
        let query = {};
        if (type === 'level' && conditions?.minLevel) {
            query['gameData.level.current'] = { $gte: conditions.minLevel };
        }
        if (type === 'income' && conditions?.minIncome) {
            query['gameData.passiveIncome'] = { $gte: conditions.minIncome };
        }

        const users = await User.find(query).select('telegramId');
        const userIds = users.map(user => user.telegramId);

        // Create notification record
        const notification = await Notification.create({
            type,
            message,
            important,
            conditions,
            button,
            stats: {
                targetCount: userIds.length,
                sentCount: 0,
                readCount: 0,
                targetUsers: userIds
            },
            status: 'sending'
        });

        // Send notifications
        let successCount = 0;
        let failedCount = 0;
        let failures = [];

        for (const userId of userIds) {
            try {
                // Telegram message options
                const options = {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                };

                if (button?.text && button?.url) {
                    options.reply_markup = {
                        inline_keyboard: [[
                            {
                                text: button.text,
                                url: button.url
                            }
                        ]]
                    };
                }

                // Format message
                let formattedMessage = '';
                if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
                formattedMessage += message;

                // Send via Telegram
                await req.bot.sendMessage(userId, formattedMessage, options);

                // Send via WebSocket if available
                const ws = req.clients.get(userId.toString());
                if (ws?.readyState === 1) {
                    ws.send(JSON.stringify({
                        type: 'notification',
                        message: formattedMessage,
                        important,
                        button
                    }));
                }

                successCount++;
            } catch (error) {
                console.error(`Error sending to ${userId}:`, error);
                failedCount++;
                failures.push({ userId, error: error.message });
            }

            // Add delay between sends
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Update notification stats
        await Notification.findByIdAndUpdate(notification._id, {
            'stats.sentCount': successCount,
            'stats.failedCount': failedCount,
            status: 'sent',
            sentAt: new Date()
        });

        res.json({
            success: true,
            data: {
                notificationId: notification._id,
                targetCount: userIds.length,
                successCount,
                failedCount,
                failures
            }
        });
    } catch (error) {
        console.error('Error sending notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test notification
router.post('/notifications/test', async (req, res) => {
    try {
        const { message, important, button, testUserId } = req.body;

        if (!testUserId) {
            return res.status(400).json({
                success: false,
                error: 'Test user ID is required'
            });
        }

        let formattedMessage = '';
        if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
        formattedMessage += '[TEST] ' + message;

        const options = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        if (button?.text && button?.url) {
            options.reply_markup = {
                inline_keyboard: [[
                    {
                        text: button.text,
                        url: button.url
                    }
                ]]
            };
        }

        await req.bot.sendMessage(testUserId, formattedMessage, options);

        // Send via WebSocket if available
        const ws = req.clients.get(testUserId.toString());
        if (ws?.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'notification',
                message: formattedMessage,
                important,
                button
            }));
        }

        res.json({
            success: true,
            message: 'Test notification sent successfully'
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;