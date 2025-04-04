// models/Task.js
import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['daily', 'achievement', 'special', 'platform'],
        default: 'daily'
    },
    reward: {
        type: Number,
        required: true,
        default: 100
    },
    link: {
        type: String,
        default: '' // Добавляем поле ссылки для заданий
    },
    requirements: {
        level: {
            type: Number,
            default: 1
        },
        income: {
            type: Number,
            default: 0
        }
    },
    icon: {
        type: String,
        default: 'default.png'
    },
    active: {
        type: Boolean,
        default: true
    },
    completions: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Task', taskSchema);