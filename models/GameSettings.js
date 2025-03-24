// models/GameSettings.js
import mongoose from 'mongoose';

const gameSettingsSchema = new mongoose.Schema({
    // Основные настройки игры
    tapValue: {
        type: Number,
        default: 1
    },
    baseEnergy: {
        type: Number,
        default: 100
    },
    energyRegenRate: {
        type: Number,
        default: 1
    },
    incomeMultiplier: {
        type: Number,
        default: 1
    },
    expMultiplier: {
        type: Number,
        default: 1
    },

    // Настройки бустов
    boosts: {
        tap3xCost: {
            type: Number,
            default: 8000
        },
        tap5xCost: {
            type: Number,
            default: 25000
        },
        duration: {
            type: Number,
            default: 86400000 // 24 часа в миллисекундах
        }
    },

    // Настройки инвестиций
    investments: {
        baseReturn: {
            type: Number,
            default: 1.5
        },
        levelMultiplier: {
            type: Number,
            default: 1.2
        }
    },

    // Требования к уровням
    levelRequirements: [{
        level: {
            type: Number,
            required: true
        },
        income: {
            type: Number,
            default: 0
        },
        title: {
            type: String,
            default: 'Уровень'
        }
    }],

    // Метаданные
    isDefault: {
        type: Boolean,
        default: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Добавляем статический метод для получения настроек по умолчанию
gameSettingsSchema.statics.getDefaultSettings = async function() {
    let defaultSettings = await this.findOne({ isDefault: true });

    if (!defaultSettings) {
        // Создаем настройки по умолчанию, если их нет
        defaultSettings = await this.create({
            isDefault: true,
            levelRequirements: [
                { level: 1, income: 0, title: 'Новичок' },
                { level: 2, income: 1000, title: 'Начинающий' },
                { level: 3, income: 5000, title: 'Продвинутый' },
                { level: 4, income: 15000, title: 'Профессионал' },
                { level: 5, income: 50000, title: 'Мастер' }
            ]
        });
    }

    return defaultSettings;
};

export default mongoose.model('GameSettings', gameSettingsSchema);