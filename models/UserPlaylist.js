const mongoose = require('mongoose');

// User ki apni banayi hui playlists (Create Playlist button wali) - ye
// existing "Playlist" model (homepage ke promotional banner slides) se
// bilkul ALAG cheez hai, is liye naya model + naam.
//
// Pehle ye data sirf localStorage me store hota tha (per-browser/device),
// is liye website par banayi playlist desktop app me nahi dikhti thi (aur
// vice versa). Ab database me hai, is liye account ke saath hamesha,
// har jagah sync rehti hai.
const userPlaylistSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        // Cover image - data URL (base64) ke tor par store hoti hai, jaisa
        // pehle localStorage me hoti thi. Chhoti thumbnail hoti hai, is liye
        // MongoDB document size limit (16MB) ke andar aasani se aa jati hai.
        image: {
            type: String,
            default: null,
        },
        songs: [
            {
                _id: false,
                id: { type: String, required: true },
                addedAt: { type: Number, required: true },
            },
        ],
        // Agar ye playlist homepage banner-click se auto-generate hui thi
        // (jaise "Trending" section ka naam), to us section ka naam yahan -
        // taake dobara usi banner click par isi playlist ko update kiya
        // ja sake, naya na banaya jaye.
        autoSection: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('UserPlaylist', userPlaylistSchema);
