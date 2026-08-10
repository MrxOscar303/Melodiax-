const mongoose = require('mongoose');

// Admin panel se add ki gayi songs isi shape mein save hoti hain.
// Ye local Audio/*.mp3 files se alag hain - inka source YouTube video hai,
// is liye songPath ki jagah youtubeId store hota hai (frontend YouTube IFrame
// Player API se isko play karta hai).
const songSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 200,
            default: '',
        },
        // Homepage pe kis section/playlist ke neeche dikhna chahiye (e.g. "Chill Music").
        // Agar naya naam diya to frontend khud naya section bana dega.
        section: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },
        // Ye song kahan se aaya - YouTube link se ya khud Mp3 upload karke.
        // Purani songs (is field ke add hone se pehle ki) sab YouTube hi
        // thin, is liye default 'youtube' rakha hai.
        sourceType: {
            type: String,
            enum: ['youtube', 'mp3'],
            default: 'youtube',
        },
        // sourceType 'youtube' ho tabhi ye dono zaroori hain (route mein check hota hai).
        youtubeId: {
            type: String,
            trim: true,
            default: '',
        },
        youtubeUrl: {
            type: String,
            trim: true,
            default: '',
        },
        // sourceType 'mp3' ho to khud upload ki gayi audio file ka path yahan save hota hai.
        audioFile: {
            type: String,
            default: '',
        },
        // Agar admin ne khud image upload ki to uska path, warna YouTube thumbnail fallback (frontend handle karega)
        image: {
            type: String,
            default: '',
        },
        // Optional "Projector" background video - agar admin ne is song ke liye
        // ye feature ON kiya ho to audio ke sath synced video background chalti hai
        // (bilkul manual/local songs wale projector feature ki tarah).
        projectorEnabled: {
            type: Boolean,
            default: false,
        },
        // projectorEnabled true ho to hi ye path save hota hai, warna khaali rehta hai.
        projectorVideo: {
            type: String,
            default: '',
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Song', songSchema);
