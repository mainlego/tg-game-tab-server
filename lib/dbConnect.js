// lib/dbConnect.js
import mongoose from 'mongoose';
import config from '../config.js';

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        };

        cached.promise = mongoose.connect(config.MONGODB_URI, opts);
    }

    try {
        cached.conn = await cached.promise;
        console.log('MongoDB connected successfully');
    } catch (e) {
        cached.promise = null;
        console.error('MongoDB connection error:', e);
        throw e;
    }

    return cached.conn;
}

export default dbConnect;