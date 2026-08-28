const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        // text = normal message, gif = Giphy URL, sticker = emoji character,
        // voice = uploaded audio file ka URL (/uploads/voice/...)
        type: {
            type: String,
            enum: ['text', 'gif', 'sticker', 'voice'],
            default: 'text',
        },
        voiceDuration: {
            type: Number, // seconds - sirf type:'voice' messages ke liye
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Do users ke darmiyan conversation history nikalna sabse aam query hai.
messageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
messageSchema.index({ recipient: 1, sender: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
