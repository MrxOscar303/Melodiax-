const mongoose = require('mongoose');

// "Educational Hub" module ke andar admin ki taraf se add ki gayi
// podcasts/informative videos isi shape mein save hoti hain - bilkul
// Song.js jaisa hi structure (YouTube link ya khud Mp3 upload, optional
// projector video), bas "section" ki jagah "category" (Physics, Math,
// Philosophy, History, Biology, waghera - ya koi bhi naya naam).
const podcastSchema = new mongoose.Schema(
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
            maxlength: 300,
            default: '',
        },
        // Educational Hub ke tabs isi field se banate hain (Physics, Math, etc.)
        category: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60,
        },
        sourceType: {
            type: String,
            enum: ['youtube', 'mp3'],
            default: 'youtube',
        },
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
        audioFile: {
            type: String,
            default: '',
        },
        image: {
            type: String,
            default: '',
        },
        projectorEnabled: {
            type: Boolean,
            default: false,
        },
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

module.exports = mongoose.model('Podcast', podcastSchema);
