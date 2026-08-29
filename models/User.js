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
        // ---------------- Friend system: presence status ----------------
        // User khud choose karta hai (customize karta hai) - kisi automatic
        // detection se nahi. "offline" tab set hota hai jab user login hi
        // nahi hai (frontend friends list mein khud handle karta hai).
        status: {
            type: String,
            enum: ['online', 'dnd', 'night', 'invisible'],
            default: 'online',
        },
        statusMessage: {
            type: String,
            trim: true,
            maxlength: 60,
            default: '',
        },
        // Friend request/accept notifications mute karne ka option
        notificationsMuted: {
            type: Boolean,
            default: false,
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 160,
            default: '',
        },
        // Profile card ka banner - user khud color choose karta hai.
        bannerColor: {
            type: String,
            trim: true,
            default: '#1db954',
        },
        // Username sirf har 7 din mein ek baar change ho sakta hai (spam/
        // confusion se bachne ke liye) - is field se pichli baar kab
        // change hua tha, ye pata chalta hai.
        usernameChangedAt: {
            type: Date,
        },
    },
    { timestamps: true } // createdAt / updatedAt khud-b-khud add ho jayenge
);

module.exports = mongoose.model('User', userSchema);
