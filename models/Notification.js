const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        // Kisko ye notification dikhni hai
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['friend_request', 'friend_accept'],
            required: true,
        },
        // Kis user ki wajah se ye notification bani (jaise request bhejne
        // wala) - frontend isse avatar/username dikha sakta hai.
        fromUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        message: {
            type: String,
            required: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
