// routes/notificationRoutes.js
import express from 'express';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Отправка уведомления
router.post('/send', async (req, res) => {
    try {
        const { type, message, important, conditions, button } = req.body;
        console.log('Получен запрос на отправку уведомления:', req.body);

        // Поиск целевых пользователей
        let query = {};
        // Для type='all' не добавляем условия в query
        if (type !== 'all') {
            if (type === 'level' && conditions?.minLevel) {
                query['gameData.level.current'] = { $gte: conditions.minLevel };
            }
            if (type === 'income' && conditions?.minIncome) {
                query['gameData.passiveIncome'] = { $gte: conditions.minIncome };
            }
        }

        console.log('Поиск пользователей с query:', query);
        const users = await User.find(query).select('telegramId');
        console.log('Найденные пользователи:', users.length);

        const userIds = users.map(user => user.telegramId);

        // Создание записи уведомления
        const notification = await Notification.create({
            type,
            message,
            important,
            conditions,
            button,
            stats: {
                sentCount: 0,
                readCount: 0,
                failedCount: 0,
                targetUsers: userIds
            },
            status: 'sending'
        });

        let successCount = 0;
        let failedCount = 0;
        let failures = [];

        // Отправка уведомлений
        for (const userId of userIds) {
            try {
                // Настройки сообщения Telegram
                const options = {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                };

                // Добавляем кнопку, если она указана
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

                // Форматирование сообщения
                let formattedMessage = '';
                if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
                formattedMessage += message;

                // Отправка через Telegram
                console.log(`Отправка уведомления в Telegram для ${userId}`);
                await req.bot.sendMessage(userId, formattedMessage, options);

                // Отправка через WebSocket
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
                console.error(`Ошибка отправки для ${userId}:`, error);
                failedCount++;
                failures.push({ userId, error: error.message });
            }

            // Добавляем паузу между отправками
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Обновление статистики уведомления
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
        console.error('Ошибка отправки уведомлений:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Тестовая отправка уведомления
router.post('/test', async (req, res) => {
    try {
        const { message, important, button, testUserId } = req.body;

        if (!testUserId) {
            return res.status(400).json({
                success: false,
                error: 'Требуется ID тестового пользователя'
            });
        }

        // Создаем тестовое уведомление в базе
        const notification = await Notification.create({
            type: 'test',
            message,
            important,
            button,
            stats: {
                sentCount: 0,
                readCount: 0,
                failedCount: 0
            },
            status: 'sending'
        });

        // Форматируем сообщение
        let formattedMessage = '[ТЕСТ] ';
        if (important) formattedMessage += '🔔 ВАЖНО!\n\n';
        formattedMessage += message;

        // Настройки сообщения
        const options = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        // Добавляем кнопку, если она указана
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

        // Отправка через Telegram
        await req.bot.sendMessage(testUserId, formattedMessage, options);

        // Отправка через WebSocket
        const ws = req.clients.get(testUserId.toString());
        if (ws?.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'notification',
                message: formattedMessage,
                important,
                button
            }));
        }

        // Обновляем статус уведомления
        await Notification.findByIdAndUpdate(notification._id, {
            status: 'sent',
            sentAt: new Date(),
            'stats.sentCount': 1
        });

        res.json({
            success: true,
            data: {
                notificationId: notification._id,
                message: 'Тестовое уведомление успешно отправлено'
            }
        });
    } catch (error) {
        console.error('Ошибка отправки тестового уведомления:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Планирование уведомления (для будущего использования)
router.post('/schedule', async (req, res) => {
    try {
        const { type, message, important, conditions, button, scheduledFor } = req.body;

        if (!scheduledFor) {
            return res.status(400).json({
                success: false,
                error: 'Требуется дата планирования уведомления'
            });
        }

        // Создание записи запланированного уведомления
        const notification = await Notification.create({
            type,
            message,
            important,
            conditions,
            button,
            scheduledFor: new Date(scheduledFor),
            status: 'scheduled'
        });

        res.status(201).json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Ошибка планирования уведомления:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Отметка уведомления как прочитанного
router.post('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Требуется ID пользователя'
            });
        }

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Уведомление не найдено'
            });
        }

        // Проверяем, был ли этот пользователь в списке целевых и не отмечал ли он уже уведомление как прочитанное
        if (!notification.stats.readBy) {
            notification.stats.readBy = [];
        }

        // Если пользователь еще не отметил уведомление как прочитанное
        if (!notification.stats.readBy.includes(userId)) {
            notification.stats.readBy.push(userId);
            notification.stats.readCount = notification.stats.readBy.length;
            await notification.save();
        }

        res.json({
            success: true,
            data: {
                readCount: notification.stats.readCount
            }
        });
    } catch (error) {
        console.error('Ошибка отметки уведомления как прочитанного:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;