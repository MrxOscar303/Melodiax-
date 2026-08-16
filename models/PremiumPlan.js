const mongoose = require('mongoose');

// "Premium" tab ke bare, cards yahan se aate hain - bilkul Playlist banner
// jaisa hi pattern (admin apna content khud likh/edit/delete kar sakta hai).
// Default 4 plans (Silver/Gold/Diamond/Platinum) seed ke tor par pehle se
// maujood hote hain (neeche routes/premium.js dekhein) - admin unko edit ya
// delete kar sakta hai, ya bilkul naye plans add kar sakta hai.
const premiumPlanSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 40,
        },
        // Free-text price label - "$4.99/mo", "Rs. 500/month", "Coming soon" wagera,
        // taake admin ko kisi fixed currency/format mein bandhna na pare.
        price: {
            type: String,
            trim: true,
            maxlength: 40,
            default: '',
        },
        // Chhoti tagline - card ke title ke neeche ek line.
        tagline: {
            type: String,
            trim: true,
            maxlength: 100,
            default: '',
        },
        // Har line ek feature/benefit ke tor par card mein bullet ki tarah dikhti hai.
        features: {
            type: [String],
            default: [],
        },
        // Card ka theme color (hex) - gradient/accent isi se banta hai.
        color: {
            type: String,
            trim: true,
            default: '#1db954',
        },
        // Chhoti cover image - crown icon ki jagah dikhti hai (optional,
        // khaali ho to purana crown icon fallback ke tor par rehta hai).
        image: {
            type: String,
            trim: true,
            default: '',
        },
        // Chhota number pehle dikhta hai (card order). Equal hone par
        // createdAt (purana pehle) se decide hota hai.
        order: {
            type: Number,
            default: 0,
        },
        // "Most Popular" jaisa chhota badge - optional, khaali ho to kuch nahi dikhega.
        badge: {
            type: String,
            trim: true,
            maxlength: 30,
            default: '',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PremiumPlan', premiumPlanSchema);
