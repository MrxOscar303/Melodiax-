// Database (MongoDB) se connection banata hai.
// Localhost pe testing ke liye MONGO_URI=mongodb://127.0.0.1:27017/spotify-clone use karein
// (Mongo Community Server local install karna hoga) YA phir free MongoDB Atlas cluster
// bana kar uska connection string .env mein daal dein (recommended - ye online hosting
// ke liye bhi bina kisi tabdeeli ke chalega).

const mongoose = require('mongoose');

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
       console.log('✅ MongoDB connected:', mongoose.connection.name);

    } catch (err) {
       console.error('❌ MongoDB connection failed:', err.message);
        process.exit(1);
    }
}

module.exports = connectDB;
