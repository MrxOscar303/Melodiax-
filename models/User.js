const mongoose = require('mongoose');

// Har user ka data isi shape mein database (MongoDB) mein save hoga.
// Password hamesha HASHED (bcrypt) save hota hai - kabhi bhi plain text nahi.
const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        // Google/Facebook se sign up karne walon ka password nahi hota, is liye required nahi.
        password: {
            type: String,
            select: false, // queries mein by default password wapas nahi aayega
        },
        profilePicture: {
            type: String,
            default: '/assets/default-avatar.png',
        },
        authProvider: {
            type: String,
            enum: ['local', 'google', 'facebook'],
            default: 'local',
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true, // sirf jinke pass googleId hai unke liye unique check hoga
        },
        facebookId: {
            type: String,
            unique: true,
            sparse: true,
        },
        // Sirf ye jinke pass true hai wahi admin panel (song add karna) use kar sakte hain
        isAdmin: {
            type: Boolean,
            default: false,
        },
        // Local (email/password) signup ke baad jab tak user apna email verify
        // (confirmation link par click) nahi karta, login allow nahi hota.
        // Google/Facebook se aane wale users ki email provider khud verify kar
        // chuka hota hai, is liye unke liye ye hamesha true set hota hai.
        isVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            select: false,
        },
        emailVerificationExpires: {
            type: Date,
            select: false,
        },
    },
    { timestamps: true } // createdAt / updatedAt khud-b-khud add ho jayenge
);

module.exports = mongoose.model('User', userSchema);
