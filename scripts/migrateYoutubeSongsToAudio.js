// Ye script sirf EK dafa chalani hai (deploy ke baad) - database mein jitni
// bhi purani songs "sourceType: youtube" (hidden iframe se bajti) hain,
// unka real audio nikaal kar Cloudinary par upload karta hai aur song ko
// "sourceType: mp3" mein badal deta hai - taake wo bhi ab reliable native
// <audio> element se bajein (jaisa local upload wale songs), aur offline
// download bhi kar sakein.
//
// Kisi bhi song ka koi data (title, section, image, playlist membership)
// DELETE ya change nahi hota - sirf uske bajne ka tareeqa (audio source)
// upgrade hota hai. Agar kisi video ka conversion fail ho jaye (private/
// restricted/deleted video), wo song bas youtube-iframe wale purane
// tareeqe par hi reh jata hai - kuch nahi toota.
//
// Chalayein (deploy ke baad sirf EK dafa):
//   node scripts/migrateYoutubeSongsToAudio.js

require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const Song = require('../models/Song');
const { getYoutubeAudioBuffer } = require('../utils/youtubeAudio');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadBufferToCloudinary(buffer, folder, resourceType) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `melodiax/${folder}`, resource_type: resourceType },
            (err, result) => {
                if (err) return reject(err);
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}

// Ek waqt mein itni songs parallel process karo (Cloudinary/network par
// ek sath bahut zyada load na daalein).
const CONCURRENCY = 3;

async function migrateOne(song) {
    try {
        console.log(`Converting: "${song.title}" (${song.youtubeId})...`);
        const buffer = await getYoutubeAudioBuffer(song.youtubeId);
        const audioUrl = await uploadBufferToCloudinary(buffer, 'audio', 'video');
        song.sourceType = 'mp3';
        song.audioFile = audioUrl;
        await song.save();
        console.log(`  done: "${song.title}"`);
        return { ok: true };
    } catch (err) {
        console.warn(`  FAILED: "${song.title}" (${song.youtubeId}) - ${err.message}`);
        return { ok: false };
    }
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    const songs = await Song.find({ sourceType: 'youtube', youtubeId: { $ne: '' } });
    console.log(`${songs.length} YouTube song(s) mile jinhe convert karna hai.\n`);

    let done = 0;
    let failed = 0;

    for (let i = 0; i < songs.length; i += CONCURRENCY) {
        const batch = songs.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(migrateOne));
        results.forEach((r) => (r.ok ? done++ : failed++));
    }

    console.log(`\n✅ ${done} song(s) convert ho gayi.`);
    if (failed) {
        console.log(`⚠️  ${failed} song(s) convert nahi ho paayi - wo purane YouTube-iframe tareeqe par hi rahengi (kuch toota nahi, sirf upgrade skip hua).`);
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
