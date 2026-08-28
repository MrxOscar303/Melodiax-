const mongoose = require('mongoose');

// Ek dastawez (document) do users ke darmiyan ka rishta represent karta hai.
// "requester" ne "recipient" ko request bheji. Status:
//   pending  - abhi tak recipient ne accept/decline nahi kiya
//   accepted - dono ab "friends" hain
// Decline/remove hone par document seedha delete kar dete hain (dobara
// request bhejna asaan rahe, purani declined history rakhne ki zaroorat nahi).
const friendshipSchema = new mongoose.Schema(
    {
        requester: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted'],
            default: 'pending',
        },
    },
    { timestamps: true }
);

// Ek jode (pair) ke beech sirf ek hi document ho sakta hai (chahe kisi ne
// bhi request bheji ho) - duplicate requests ko database level par hi rok
// dete hain.
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);
