const mongoose = require('mongoose');

// Sirf "kaunse gaane is account ne offline ke liye download kiye hain" ki
// list track karta hai - asal audio file yahan store NAHI hoti (wo har
// device apni IndexedDB me khud rakhta hai, jaisa pehle se hota tha).
// Isi list ki wajah se koi bhi device (website ya desktop app) jaan
// leta hai "in gaano ko offline hona chahiye", aur agar uski apni local
// copy missing ho to khud-ba-khud fetch kar leta hai.
const downloadRecordSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        songId: {
            type: String,
            required: true,
        },
        name: { type: String, default: '' },
        image: { type: String, default: '' },
        desc: { type: String, default: '' },
        downloadedAt: { type: Number, default: () => Date.now() },
    },
    { timestamps: false }
);

// Ek user ek song ko sirf ek hi baar list me rakh sakta hai.
downloadRecordSchema.index({ owner: 1, songId: 1 }, { unique: true });

module.exports = mongoose.model('DownloadRecord', downloadRecordSchema);
