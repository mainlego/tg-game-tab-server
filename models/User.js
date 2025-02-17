// models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true
    },
    first_name: String,
    last_name: String,
    username: String,
    photo_url: String,
    language_code: String,
    blocked: {
        type: Boolean,
        default: false
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    gameData: {
        balance: {
            type: Number,
            default: 0
        },
        passiveIncome: {
            type: Number,
            default: 0
        },
        energy: {
            current: { type: Number, default: 1000 },
            max: { type: Number, default: 1000 },
            regenRate: { type: Number, default: 1 },
            lastRegenTime: { type: Number, default: () => Date.now() }
        },
        level: {
            current: { type: Number, default: 1 },
            max: { type: Number, default: 10 },
            progress: { type: Number, default: 0 },
            title: { type: String, default: 'Новичок' }
        },
        multipliers: {
            tapValue: { type: Number, default: 1 },
            tapMultiplier: { type: Number, default: 1 },
            incomeBoost: { type: Number, default: 1 }
        },
        investments: {
            purchased: [{
                id: String,
                level: Number,
                income: Number,
                purchaseDate: Date,
                type: String
            }],
            activeIncome: { type: Number, default: 0 },
            lastCalculation: { type: Date, default: Date.now }
        },
        stats: {
            totalClicks: { type: Number, default: 0 },
            totalEarned: { type: Number, default: 0 },
            maxPassiveIncome: { type: Number, default: 0 }
        }
    }
}, {
    timestamps: true
});

export default mongoose.models.User || mongoose.model('User', UserSchema);