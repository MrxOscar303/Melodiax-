const mongoose = require('mongoose');

// Homepage ke bilkul top par jo "Playlists" slide-banner dikhta hai, uske
// slides isi shape mein save hote hain. Ye Song ke section-based grouping se
// bilkul alag hai - purely promotional/editorial banner hai jo sirf admin
// khud banata/edit karta hai.
const playlistSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 120,
            default: '',
        },
        // Playlist cover image - admin isko upload karta hai (required).
        image: {
            type: String,
            required: true,
        },
        // Slide ka background color - hex string (e.g. "#2563eb"). Frontend
        // par ek chhota preset swatch picker (blue/green/red/yellow/purple)
        // + custom color input, dono isi field ko set karte hain.
        bgColor: {
            type: String,
            trim: true,
            default: '#2563eb',
        },
        // Optional: agar ye naam kisi existing homepage section (music-section
        // <h2>) se match kare, to slide par click karne par user seedha wahan
        // scroll ho jata hai. Khaali ho to slide sirf dikhane ke liye hai.
        linkedSection: {
            type: String,
            trim: true,
            maxlength: 60,
            default: '',
        },
        // Chhota number pehle dikhta hai (slide order). Equal hone par
        // createdAt (purana pehle) se decide hota hai.
        order: {
            type: Number,
            default: 0,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Playlist', playlistSchema);
