// models/Referral.js
import mongoose from 'mongoose';

const ReferralSchema = new mongoose.Schema({
    referrerId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        unique: true
    },
    userData: {
        first_name: String,
        last_name: String,
        username: String,
        language_code: String,
        photo_url: String
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    rewardClaimed: {
        type: Boolean,
        default: false
    }
});

// Проверяем, если модель уже существует
const Referral = mongoose.models.Referral || mongoose.model('Referral', ReferralSchema);

export default Referral;