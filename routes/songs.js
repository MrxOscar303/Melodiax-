const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;

const Song = require('../models/Song');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Buffer (memory mein aayi hui file) ko seedha Cloudinary par upload karta hai
// - koi bhi hosting ho (jahan disk persist nahi hota), ye hamesha kaam karega.
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

// Purani entry agar local "/uploads/..." path thi (hosting se pehle ki) to
// use disk se hatane ki koshish karta hai - Cloudinary URLs (https se shuru)
// ke liye kuch nahi karta, kyunke wo disk pe hain hi nahi.
function deleteOldLocalFileIfAny(relativePath) {
    if (relativePath && relativePath.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', 'public', relativePath);
        fs.unlink(oldPath, () => {});
    }
}

// ---------- Song cover image + projector video + mp3 audio upload (Multer) ----------
// Files ab disk par save nahi hoti - memory mein rakhi jaati hain, phir
// seedha Cloudinary par upload hoti hain (neeche routes mein). Isse hosting
// par files "gayab" nahi hongi.
const storage = multer.memoryStorage();

// Video/audio files images se kaafi bari hoti hain, is liye limit dono field ke
// liye bara rakha hai (ek hi multer instance teeno field handle karta hai) -
// image field ke liye allowed mimetypes wahi purane hain, projectorVideo field
// ke liye video mimetypes, aur audio field ke liye sirf mp3/audio mimetypes.
const upload = multer({
    storage,
    // Cloudinary ke FREE plan ka video upload limit khud 100MB hai (isse
    // upar chunked/paid upload chahiye hoti) - is liye 100MB is exact
    // "ceiling" hai, thoda bhi upar jane wali file fail ho jayegi.
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'image') {
            const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (allowed.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Only image files (jpg, png, webp, gif) allowed hain'));
        }
        if (file.fieldname === 'projectorVideo') {
            const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
            if (allowed.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Only video files (mp4, webm, ogg, mov) allowed hain'));
        }
        if (file.fieldname === 'audio') {
            const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
            if (allowed.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Only audio files (mp3, wav, ogg, m4a) allowed hain'));
        }
        cb(new Error('Unexpected upload field'));
    },
});

// image, projectorVideo aur audio - teeno ek hi request mein optional files hain
const uploadSongFiles = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'projectorVideo', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
]);

// "true"/"on"/"1" jaise alag-alag string values ko boolean mein convert karta hai
// (checkbox se "on" aata hai, JS se hum "true"/"false" bhejte hain)
function parseBoolean(value) {
    return value === 'true' || value === 'on' || value === '1';
}

// Bulk misuse se bachne ke liye - admin panel se song add karna bhi rate-limited hai
const songLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many attempts have occurred, please try again after a while.' },
});

// Har tarah ka YouTube URL (watch?v=, youtu.be/, shorts/, embed/) se video ID nikalta hai
function extractYoutubeId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Default YouTube thumbnail URL - is ko hum DB mein `image` field ke andar
// save kar dete hain (sirf frontend pe live compute nahi karte) taake har
// song ka data (name, section, image) hamesha database mein maujood ho,
// chahe admin ne khud koi picture upload ki ho ya na ki ho.
function youtubeThumbnailUrl(youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
}

// ============ LIST ALL SONGS (public - homepage inhe render karta hai) ============
router.get('/', async (req, res) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 });
        res.json({ songs });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load songs' });
    }
});

// ============ ADD SONG (admin only) ============
router.post(
    '/',
    requireAuth,
    requireAdmin,
    songLimiter,
    uploadSongFiles,
    async (req, res) => {
        try {
            const { title, description, section, youtubeUrl } = req.body;
            // 'youtube' (default, backward-compatible) ya 'mp3' - do tareeqon
            // mein se koi bhi ek admin ye song add karte waqt chun sakta hai.
            const sourceType = req.body.sourceType === 'mp3' ? 'mp3' : 'youtube';

            if (!title || !section) {
                return res.status(400).json({ message: 'Title and section are required' });
            }

            const imageFile = req.files && req.files.image ? req.files.image[0] : null;
            const videoFile = req.files && req.files.projectorVideo ? req.files.projectorVideo[0] : null;
            const audioFileUpload = req.files && req.files.audio ? req.files.audio[0] : null;

            let youtubeId = '';
            let image = '';
            let audioFile = '';

            // Projector video - optional feature. ON hai to video upload zaroori hai.
            const projectorEnabled = parseBoolean(req.body.projectorEnabled);
            if (projectorEnabled && !videoFile) {
                return res.status(400).json({ message: 'Projector video is ON - please upload a video file' });
            }

            // Uploaded files (agar hain) Cloudinary par bhej dete hain - pehle
            // sab uploads ek sath shuru kar dete hain taake parallel ho jayein.
            const [uploadedImageUrl, uploadedVideoUrl, uploadedAudioUrl] = await Promise.all([
                imageFile ? uploadBufferToCloudinary(imageFile.buffer, 'songs', 'image') : Promise.resolve(null),
                projectorEnabled && videoFile ? uploadBufferToCloudinary(videoFile.buffer, 'videos', 'video') : Promise.resolve(null),
                audioFileUpload ? uploadBufferToCloudinary(audioFileUpload.buffer, 'audio', 'video') : Promise.resolve(null),
            ]);

            if (sourceType === 'mp3') {
                if (!uploadedAudioUrl) {
                    return res.status(400).json({ message: 'Mp3 file upload is required' });
                }
                audioFile = uploadedAudioUrl;
                // YouTube thumbnail fallback yahan possible nahi - agar admin
                // ne khud cover na di ho to ek generic music-note cover use hoti hai.
                image = uploadedImageUrl || '/assets/default-song-cover.svg';
            } else {
                if (!youtubeUrl) {
                    return res.status(400).json({ message: 'YouTube link is required' });
                }
                youtubeId = extractYoutubeId(youtubeUrl.trim());
                if (!youtubeId) {
                    return res.status(400).json({ message: 'Could not understand this YouTube link, please enter a valid one' });
                }
                // Agar admin ne khud image upload ki to wahi save hoti hai, warna
                // YouTube ki default thumbnail ka URL seedha database mein save
                // kar dete hain (khaali chorte nahi) - taake har song ka image
                // data hamesha DB mein maujood rahe.
                image = uploadedImageUrl || youtubeThumbnailUrl(youtubeId);
            }

            const projectorVideo = projectorEnabled && uploadedVideoUrl ? uploadedVideoUrl : '';

            const song = await Song.create({
                title: title.trim(),
                description: (description || '').trim(),
                section: section.trim(),
                sourceType,
                youtubeId,
                youtubeUrl: sourceType === 'youtube' ? youtubeUrl.trim() : '',
                audioFile,
                image,
                projectorEnabled,
                projectorVideo,
                addedBy: req.user._id,
            });

            res.status(201).json({ message: 'Song add ho gaya!', song });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Could not add song, please try again' });
        }
    }
);

// ============ EDIT SONG (admin only) ============
router.put(
    '/:id',
    requireAuth,
    requireAdmin,
    uploadSongFiles,
    async (req, res) => {
        try {
            const song = await Song.findById(req.params.id);
            if (!song) {
                return res.status(404).json({ message: 'Song not found' });
            }

            const { title, description, section, youtubeUrl } = req.body;
            const sourceType = req.body.sourceType === 'mp3' || req.body.sourceType === 'youtube'
                ? req.body.sourceType
                : song.sourceType;
            const imageFile = req.files && req.files.image ? req.files.image[0] : null;
            const videoFile = req.files && req.files.projectorVideo ? req.files.projectorVideo[0] : null;
            const audioFileUpload = req.files && req.files.audio ? req.files.audio[0] : null;

            // Naye uploaded files (agar hain) Cloudinary par bhej dete hain
            const [uploadedImageUrl, uploadedVideoUrl, uploadedAudioUrl] = await Promise.all([
                imageFile ? uploadBufferToCloudinary(imageFile.buffer, 'songs', 'image') : Promise.resolve(null),
                videoFile ? uploadBufferToCloudinary(videoFile.buffer, 'videos', 'video') : Promise.resolve(null),
                audioFileUpload ? uploadBufferToCloudinary(audioFileUpload.buffer, 'audio', 'video') : Promise.resolve(null),
            ]);

            if (title !== undefined) song.title = title.trim();
            if (description !== undefined) song.description = description.trim();
            if (section !== undefined) song.section = section.trim();

            // Manually upload ki gayi image hamesha "/uploads/songs/..." se shuru
            // hoti hai - agar aisa nahi hai to iska matlab abhi YouTube ki
            // default thumbnail (ya mp3 ka generic cover) hi save hai, admin
            // ki apni pic nahi.
            const hadManualImage = !!song.image && song.image.startsWith('/uploads/songs/');

            if (sourceType !== song.sourceType) {
                // Ek type se dusre me switch ho raha hai - purani type-specific
                // values saaf karo taake mixed/stale data na reh jaye.
                if (sourceType === 'mp3') {
                    if (!uploadedAudioUrl && !song.audioFile) {
                        return res.status(400).json({ message: 'Mp3 file upload is required' });
                    }
                    song.youtubeId = '';
                    song.youtubeUrl = '';
                } else {
                    if ((!youtubeUrl || !youtubeUrl.trim()) && !song.youtubeUrl) {
                        return res.status(400).json({ message: 'YouTube link is required' });
                    }
                    deleteOldLocalFileIfAny(song.audioFile);
                    song.audioFile = '';
                }
                song.sourceType = sourceType;
            }

            if (sourceType === 'mp3') {
                if (uploadedAudioUrl) {
                    deleteOldLocalFileIfAny(song.audioFile);
                    song.audioFile = uploadedAudioUrl;
                }
                if (!imageFile && !hadManualImage && !song.image) {
                    song.image = '/assets/default-song-cover.svg';
                }
            } else if (youtubeUrl !== undefined && youtubeUrl.trim() !== '') {
                const youtubeId = extractYoutubeId(youtubeUrl.trim());
                if (!youtubeId) {
                    return res.status(400).json({ message: 'Could not understand this YouTube link, please enter a valid one' });
                }
                song.youtubeId = youtubeId;
                song.youtubeUrl = youtubeUrl.trim();

                // Link badla aur admin ne khud koi nayi image upload nahi ki -
                // to saved default thumbnail ko bhi naye video ke mutabiq update kardo.
                if (!imageFile && !hadManualImage) {
                    song.image = youtubeThumbnailUrl(youtubeId);
                }
            }

            if (uploadedImageUrl) {
                // Purani khud-upload ki hui cover image ho to disk se hata dein
                // (YouTube thumbnail fallback the to kuch delete nahi karna).
                if (hadManualImage) {
                    deleteOldLocalFileIfAny(song.image);
                }
                song.image = uploadedImageUrl;
            }

            // ---------- Projector video (optional yes/no feature) ----------
            if (req.body.projectorEnabled !== undefined) {
                const projectorEnabled = parseBoolean(req.body.projectorEnabled);

                if (!projectorEnabled) {
                    // Feature OFF kiya - purani video (agar thi) disk se hata dein
                    deleteOldLocalFileIfAny(song.projectorVideo);
                    song.projectorEnabled = false;
                    song.projectorVideo = '';
                } else if (uploadedVideoUrl) {
                    // Feature ON hai aur nayi video aayi - purani hoti to hata kar naye se replace
                    deleteOldLocalFileIfAny(song.projectorVideo);
                    song.projectorEnabled = true;
                    song.projectorVideo = uploadedVideoUrl;
                } else if (!song.projectorVideo) {
                    // Feature ON karna chahte hain lekin na purani video hai na nayi upload hui
                    return res.status(400).json({ message: 'Projector video is ON - please upload a video file' });
                } else {
                    // ON hi rehne dena hai, koi nayi video nahi aayi - purani wahi rehne do
                    song.projectorEnabled = true;
                }
            }

            await song.save();
            res.json({ message: 'Song update ho gaya!', song });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Could not update song' });
        }
    }
);

// ============ DELETE SONG (admin only) ============
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const song = await Song.findByIdAndDelete(req.params.id);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }
        // Projector video / mp3 audio - agar purani (pre-Cloudinary) local file hai
        // to disk se orphan hone se bacha lein. Cloudinary URLs ke liye kuch nahi karte.
        deleteOldLocalFileIfAny(song.projectorVideo);
        deleteOldLocalFileIfAny(song.audioFile);
        res.json({ message: 'Song delete ho gaya' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not delete song' });
    }
});

module.exports = router;
