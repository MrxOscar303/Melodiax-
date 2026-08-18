// YouTube video se sirf AUDIO stream nikal kar ek Buffer mein return karta
// hai - koi ffmpeg/video processing zaroori nahi (YouTube khud alag
// "audio-only" formats deta hai, e.g. itag 140 ka .m4a). Ye buffer phir
// Cloudinary par upload ho kar normal <audio> element se bajaya ja sakta
// hai - bilkul local upload wale mp3 songs jaisa.
//
// WAJAH: hidden YouTube <iframe> player se seedha audio bajana mobile par
// (khaas kar iOS) bahut fragile hai - referrer/embedding errors (153, 101,
// 150), API load timeouts, background playback na chalna, lock-screen
// widget na aana - ye sab isi hidden-iframe approach ki wajah se hote hain.
// Real audio file bana kar apne Cloudinary se serve karne se ye SAARI
// dictionary of problems khatam ho jati hai, kyunki phir client seedha
// YouTube se baat hi nahi karta.

const ytdl = require('@distube/ytdl-core');

const MAX_AUDIO_BYTES = 60 * 1024 * 1024; // 60MB safety cap (~ typical 15-20 min song se zyada)

/**
 * @param {string} youtubeId - 11-character YouTube video ID
 * @returns {Promise<Buffer>}
 */
function getYoutubeAudioBuffer(youtubeId) {
    return new Promise((resolve, reject) => {
        const url = `https://www.youtube.com/watch?v=${youtubeId}`;
        let stream;
        try {
            stream = ytdl(url, {
                filter: 'audioonly',
                quality: 'highestaudio',
            });
        } catch (err) {
            return reject(err);
        }

        const chunks = [];
        let totalBytes = 0;
        let settled = false;

        const cleanupAndReject = (err) => {
            if (settled) return;
            settled = true;
            stream.destroy();
            reject(err);
        };

        stream.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_AUDIO_BYTES) {
                cleanupAndReject(new Error('Audio file too large (over 60MB) - video too long for auto-conversion'));
                return;
            }
            chunks.push(chunk);
        });

        stream.on('end', () => {
            if (settled) return;
            settled = true;
            resolve(Buffer.concat(chunks));
        });

        stream.on('error', (err) => {
            cleanupAndReject(err);
        });
    });
}

module.exports = { getYoutubeAudioBuffer };
