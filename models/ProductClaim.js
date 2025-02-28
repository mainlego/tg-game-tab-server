// models/ProductClaim.js
import mongoose from 'mongoose';

const ProductClaimSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    userData: {
        first_name: String,
        last_name: String,
        username: String,
        language_code: String,
        photo_url: String
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Product'
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'cancelled'],
        default: 'pending'
    },
    claimData: {
        type: Object,
        default: {}
    },
    note: {
        type: String,
        default: ''
    },
    adminComment: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

export default mongoose.models.ProductClaim || mongoose.model('ProductClaim', ProductClaimSchema);