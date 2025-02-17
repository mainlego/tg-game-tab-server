// models/Notification.js
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['all', 'level', 'income', 'test'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    important: {
        type: Boolean,
        default: false
    },
    button: {
        text: String,
        url: String
    },
    conditions: {
        minLevel: {
            type: Number,
            default: 1
        },
        minIncome: {
            type: Number,
            default: 0
        }
    },
    stats: {
        sentCount: {
            type: Number,
            default: 0
        },
        readCount: {
            type: Number,
            default: 0
        },
        failedCount: {
            type: Number,
            default: 0
        },
        targetUsers: [{
            type: String
        }]
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sending', 'sent', 'cancelled'],
        default: 'draft'
    },
    scheduledFor: Date,
    sentAt: Date
}, {
    timestamps: true
});

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);