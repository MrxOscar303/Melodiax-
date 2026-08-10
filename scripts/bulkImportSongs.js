// scripts/bulkImportSongs.js
//
// Ye script purani website ke data (public/Index.html + public/Script.js) se
// saari 104 songs ki details khud parse karta hai (naam, artist, section,
// projector video), phir:
//   1. Har song ki mp3 + image (aur agar hai to projector video) Cloudinary
//      par upload karta hai
//   2. Cloudinary URLs ke sath ek Song document seedha MongoDB mein bana deta hai
//
// ISKO CHALANE SE PEHLE:
//   1. npm install cloudinary   (project root mein)
//   2. .env file mein ye 3 lines add karein (Cloudinary dashboard se milengi):
//        CLOUDINARY_CLOUD_NAME=xxxxx
//        CLOUDINARY_API_KEY=xxxxx
//        CLOUDINARY_API_SECRET=xxxxx
//      (MONGO_URI pehle se .env mein honi chahiye)
//   3. Project root mein "Audio", "Images", "Videos" naam ki folders rakhein
//      jinme purani website jaisi hi numbered files hon (Audio/1.mp3,
//      Images/1.jpg, Videos/1.mp4, waghera)
//   4. Chalayein: node scripts/bulkImportSongs.js
//
// Ye script SIRF local computer par chalana hai (jahan aapki mp3/image/video
// files maujood hain) - hosting server par nahi.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Song = require('../models/Song');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ROOT = path.join(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT, 'public', 'Index.html');
const SCRIPT_JS_PATH = path.join(ROOT, 'public', 'Script.js');

// Local folders jahan aapki asal files pari hain (script inhe upload karega)
// NOTE: Audio/Images/Videos "public" folder ke andar hain, isliye base path
// public/ hai - agar aap inhe project root mein move kar dein to PUBLIC_BASE
// ko '' (khali string) kar dein.
const PUBLIC_BASE = 'public';
const AUDIO_DIR = path.join(ROOT, PUBLIC_BASE, 'Audio');
const IMAGES_DIR = path.join(ROOT, PUBLIC_BASE, 'Images');
const VIDEOS_DIR = path.join(ROOT, PUBLIC_BASE, 'Videos');

// ---------- Step 1: purani Script.js se songs[] array nikalna ----------
function extractSongsArray() {
    const src = fs.readFileSync(SCRIPT_JS_PATH, 'utf8');
    const match = src.match(/const songs = (\[[\s\S]*?\n\];)/);
    if (!match) throw new Error('Script.js mein "const songs = [...]" nahi mila');
    const arrayText = match[1].replace(/;\s*$/, '');
    // eslint-disable-next-line no-eval
    const songs = eval(arrayText);
    return songs;
}

// ---------- Step 2: Index.html se har song ka section (h2) nikalna ----------
function extractSectionsInOrder() {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    const sectionRegex = /<h2>(.*?)<\/h2>/g;
    const sections = [];
    let m;
    while ((m = sectionRegex.exec(html))) {
        sections.push({ name: m[1].trim(), index: m.index });
    }

    const cardRegex = /class="music-card"/g;
    const cardPositions = [];
    while ((m = cardRegex.exec(html))) cardPositions.push(m.index);

    return cardPositions.map((pos) => {
        let name = null;
        for (const s of sections) {
            if (s.index < pos) name = s.name;
            else break;
        }
        return name;
    });
}

// ---------- Cloudinary upload helper ----------
async function uploadFile(localPath, folder, resourceType) {
    if (!fs.existsSync(localPath)) return null;

    // Cloudinary free plan: image max 10MB, video/audio max 100MB. Pehle hi
    // warn kar dete hain taake pata chale kaunsi file masla kar rahi hai.
    const sizeMB = fs.statSync(localPath).size / (1024 * 1024);
    const limitMB = resourceType === 'image' ? 10 : 100;
    if (sizeMB > limitMB) {
        console.warn(`   ⚠️  ${path.basename(localPath)} ${sizeMB.toFixed(1)}MB hai (Cloudinary free limit ${limitMB}MB) - fail ho sakti hai`);
    }

    const result = await cloudinary.uploader.upload(localPath, {
        folder: `melodiax/${folder}`,
        resource_type: resourceType,
    });
    return result.secure_url;
}

async function run() {
    await connectDB();

    const songs = extractSongsArray();
    const sections = extractSectionsInOrder();

    if (songs.length !== sections.length) {
        console.warn(
            `⚠️  Warning: ${songs.length} songs mile lekin ${sections.length} section-slots mile. ` +
            `Number match nahi kar raha - sections shayad theek se assign na hon, result check kar lein.`
        );
    }

    const videoUrlCache = new Map(); // same projector video baar baar upload na ho

    let done = 0;
    let skipped = 0;
    let failed = 0;
    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const section = sections[i] || 'Uncategorized';

        console.log(`[${i + 1}/${songs.length}] Uploading: ${song.songName}`);

        // Agar ye song pichle (fail hue) run mein already add ho chuki hai to
        // dobara duplicate na banayein - skip kar dein.
        const alreadyExists = await Song.findOne({ title: song.songName, section });
        if (alreadyExists) {
            console.log('   ⏭️  Already database mein hai, skip kiya');
            skipped++;
            continue;
        }

        try {
            const audioLocalPath = path.join(ROOT, PUBLIC_BASE, song.songPath); // e.g. public/Audio/5.mp3
            const imageLocalPath = path.join(ROOT, PUBLIC_BASE, song.songImage); // e.g. public/Images/5.jpg

            const audioUrl = await uploadFile(audioLocalPath, 'audio', 'video'); // mp3 = resource_type "video" on Cloudinary
            const imageUrl = await uploadFile(imageLocalPath, 'images', 'image');

            let projectorVideoUrl = '';
            if (song.projector && song.videoPath) {
                const videoLocalPath = path.join(ROOT, PUBLIC_BASE, song.videoPath);
                if (videoUrlCache.has(song.videoPath)) {
                    projectorVideoUrl = videoUrlCache.get(song.videoPath);
                } else {
                    projectorVideoUrl = (await uploadFile(videoLocalPath, 'videos', 'video')) || '';
                    videoUrlCache.set(song.videoPath, projectorVideoUrl);
                }
            }

            if (!audioUrl) {
                console.warn(`   ⚠️  mp3 nahi mili: ${audioLocalPath} - is song ko skip kiya`);
                failed++;
                continue;
            }

            await Song.create({
                title: song.songName,
                description: song.songDes || '',
                section,
                sourceType: 'mp3',
                audioFile: audioUrl,
                image: imageUrl || '',
                projectorEnabled: !!song.projector,
                projectorVideo: projectorVideoUrl,
            });

            done++;
        } catch (err) {
            // Is song ka upload/save fail hua (jaise image 10MB se badi, ya
            // koi aur Cloudinary error) - is ek song ko skip kar ke aage
            // baaki 103 songs process karte rehte hain, poora script nahi rukta.
            console.error(`   ❌ Fail: ${err.message || err} - is song ko skip kiya`);
            failed++;
        }
    }

    console.log(`\n✅ Done! ${done} nayi songs add hui, ${skipped} pehle se thi, ${failed} fail/skip hui (upar dekhein kaunsi).`);
    await mongoose.connection.close();
}

run().catch((err) => {
    console.error('❌ Script fail ho gaya:', err);
    process.exit(1);
});
