// scripts/cleanupDummySongs.js
//
// Aapki database mein purani "demo" songs (Starboy, Blinding Lights, Heat
// Waves, Stay, waghera) hain jo asal 104 songs se pehle ki hain aur unko
// dabaa rahi hain. Ye script un dummy entries ko dhoond kar remove karta hai
// - sirf wahi songs rakhta hai jo aapki asal Script.js list mein hain.
//
// SAFETY: Ye DEFAULT mein sirf DIKHATA hai ke kya delete hoga, kuch delete
// nahi karta. Jab list check kar lein aur sahi lage, to phir isay
// "--confirm" flag ke sath dobara chalayein taake asal delete ho.
//
// Chalane ka tareeka:
//   1. Pehle (dry run - kuch delete nahi hoga): node scripts/cleanupDummySongs.js
//   2. List check karne ke baad (asal delete): node scripts/cleanupDummySongs.js --confirm

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Song = require('../models/Song');

const ROOT = path.join(__dirname, '..');
const SCRIPT_JS_PATH = path.join(ROOT, 'public', 'Script.js');

function extractRealSongTitles() {
    const src = fs.readFileSync(SCRIPT_JS_PATH, 'utf8');
    const match = src.match(/const songs = (\[[\s\S]*?\n\];)/);
    if (!match) throw new Error('Script.js mein "const songs = [...]" nahi mila');
    const arrayText = match[1].replace(/;\s*$/, '');
    // eslint-disable-next-line no-eval
    const songs = eval(arrayText);
    // Trim + extra spaces normalize karte hain taake chhoti si whitespace
    // farq ki wajah se koi real song "dummy" na samjhi jaye.
    return new Set(songs.map((s) => s.songName.trim().replace(/\s+/g, ' ')));
}

function normalizeTitle(title) {
    return (title || '').trim().replace(/\s+/g, ' ');
}

async function run() {
    await connectDB();

    const realTitles = extractRealSongTitles();
    const allSongs = await Song.find({});

    const toDelete = allSongs.filter((s) => !realTitles.has(normalizeTitle(s.title)));
    const toKeep = allSongs.filter((s) => realTitles.has(normalizeTitle(s.title)));

    console.log(`\nTotal songs database mein: ${allSongs.length}`);
    console.log(`Asal (real) songs jo rakhi jayengi: ${toKeep.length}`);
    console.log(`Dummy/purani songs jo hataayi jayengi: ${toDelete.length}\n`);

    if (toDelete.length > 0) {
        console.log('--- Ye songs DELETE hongi ---');
        toDelete.forEach((s) => console.log(`  - "${s.title}" (section: ${s.section})`));
        console.log('');
    }

    const confirm = process.argv.includes('--confirm');

    if (!confirm) {
        console.log('👀 Ye sirf ek PREVIEW thi - abhi kuch delete nahi hua.');
        console.log('Agar upar wali list sahi lag rahi hai (sirf purani/demo songs hain,');
        console.log('aapki koi zaroori song nahi), to ye chalayein:\n');
        console.log('   node scripts/cleanupDummySongs.js --confirm\n');
    } else {
        // Delete se pehle ek backup file bana dete hain (title, section, sab
        // URLs) - agar kabhi galti se koi zaroori song delete ho jaye to
        // isi file se manually wapis add ki ja sakti hai.
        const backupPath = path.join(ROOT, `deleted-songs-backup-${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(toDelete, null, 2));
        console.log(`💾 Backup save ho gaya: ${backupPath}`);

        const ids = toDelete.map((s) => s._id);
        const result = await Song.deleteMany({ _id: { $in: ids } });
        console.log(`✅ ${result.deletedCount} dummy songs delete ho gayi.`);
    }

    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Script fail ho gaya:', err);
    process.exit(1);
});
