// models/UserTask.js
import mongoose from 'mongoose';

const UserTaskSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Task'
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Создаем составной индекс для уникальности пары пользователь-задание
UserTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });

export default mongoose.models.UserTask || mongoose.model('UserTask', UserTaskSchema);