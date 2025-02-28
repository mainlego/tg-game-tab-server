// models/Product.js
import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['physical', 'digital', 'service'],
        default: 'digital'
    },
    requiredIncome: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        default: '' // URL изображения
    },
    active: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    claimInstructions: {
        type: String,
        default: ''
    },
    gradient: {
        type: String,
        default: 'linear-gradient(140.83deg, rgb(111, 95, 242) 0%, rgb(73, 51, 131) 100%)'
    },
    stats: {
        claims: {
            type: Number,
            default: 0
        },
        completedClaims: {
            type: Number,
            default: 0
        },
        cancelledClaims: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);