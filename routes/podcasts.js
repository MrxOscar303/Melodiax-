const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;

const Podcast = require('../models/Podcast');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

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

function deleteOldLocalFileIfAny(relativePath) {
    if (relativePath && relativePath.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', 'public', relativePath);
        fs.unlink(oldPath, () => {});
    }
}

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 40 * 1024 * 1024 }, // 40MB (projector video ke liye)
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
        if (file.fieldname === 'mp4File') {
            if (file.mimetype === 'video/mp4') return cb(null, true);
            return cb(new Error('Only mp4 files allowed hain'));
        }
        cb(new Error('Unexpected upload field'));
    },
});

const uploadPodcastFiles = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'projectorVideo', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'mp4File', maxCount: 1 },
]);

function parseBoolean(value) {
    return value === 'true' || value === 'on' || value === '1';
}

const podcastLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many attempts have occurred, please try again after a while.' },
});

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

function youtubeThumbnailUrl(youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
}

// mp3/mp4 file ki actual duration (seconds) uski buffer se nikalta hai -
// koi ffmpeg install ki zaroorat nahi, pure-JS parser hai.
async function getAudioDurationFromBuffer(buffer, mimeType) {
    try {
        const { parseBuffer } = await import('music-metadata');
        const metadata = await parseBuffer(buffer, mimeType);
        return Math.round(metadata.format.duration || 0);
    } catch (err) {
        console.warn('Duration nahi nikal saka (mp3/mp4):', err.message);
        return 0;
    }
}

// YouTube Data API key ke bina duration - watch page ke HTML se
// "lengthSeconds" nikal lete hain (YouTube khud ye apne player data mein
// bhejta hai). Agar YouTube ne format badal diya to bas duration 0 rahegi -
// baaki sab kaam normal chalta rahega.
async function getYoutubeDurationSeconds(youtubeId) {
    try {
        const res = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        const html = await res.text();
        const match = html.match(/"lengthSeconds":"(\d+)"/) || html.match(/"approxDurationMs":"(\d+)"/);
        if (!match) {
            console.warn('YouTube duration: pattern not found in page HTML (video id:', youtubeId, ')');
            return 0;
        }
        const value = parseInt(match[1], 10);
        // approxDurationMs milliseconds mein hota hai - seconds mein convert karo
        return match[0].startsWith('"approxDurationMs"') ? Math.round(value / 1000) : value;
    } catch (err) {
        console.warn('YouTube duration nahi nikal saka:', err.message);
        return 0;
    }
}

// ============ LIST ALL PODCASTS (public - Educational Hub inhe render karta hai) ============
router.get('/', async (req, res) => {
    try {
        const podcasts = await Podcast.find().sort({ createdAt: -1 });
        res.json({ podcasts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load podcasts' });
    }
});

// ============ ADD PODCAST (admin only) ============
router.post(
    '/',
    requireAuth,
    requireAdmin,
    podcastLimiter,
    uploadPodcastFiles,
    async (req, res) => {
        try {
            const { title, description, category, youtubeUrl } = req.body;
            const rawSourceType = req.body.sourceType;
            const sourceType = (rawSourceType === 'mp3' || rawSourceType === 'mp4') ? rawSourceType : 'youtube';

            if (!title || !category) {
                return res.status(400).json({ message: 'Title and category are required' });
            }

            const imageFile = req.files && req.files.image ? req.files.image[0] : null;
            const videoFile = req.files && req.files.projectorVideo ? req.files.projectorVideo[0] : null;
            const audioFileUpload = req.files && req.files.audio ? req.files.audio[0] : null;
            const mp4FileUpload = req.files && req.files.mp4File ? req.files.mp4File[0] : null;

            let youtubeId = '';
            let image = '';
            let audioFile = '';

            // Mp4 mode ke liye projector hamesha "on" hi hota hai (khud video se
            // auto-set), is liye us mode mein manually bheja gaya projectorEnabled ignore karte hain.
            const projectorEnabled = sourceType === 'mp4' ? true : parseBoolean(req.body.projectorEnabled);
            if (sourceType !== 'mp4' && projectorEnabled && !videoFile) {
                return res.status(400).json({ message: 'Projector video is ON - please upload a video file' });
            }
            if (sourceType === 'mp4' && !mp4FileUpload) {
                return res.status(400).json({ message: 'Mp4 file upload is required' });
            }

            const [uploadedImageUrl, uploadedVideoUrl, uploadedAudioUrl, uploadedMp4Url] = await Promise.all([
                imageFile ? uploadBufferToCloudinary(imageFile.buffer, 'podcasts', 'image') : Promise.resolve(null),
                sourceType !== 'mp4' && projectorEnabled && videoFile ? uploadBufferToCloudinary(videoFile.buffer, 'podcast-videos', 'video') : Promise.resolve(null),
                audioFileUpload ? uploadBufferToCloudinary(audioFileUpload.buffer, 'podcast-audio', 'video') : Promise.resolve(null),
                mp4FileUpload ? uploadBufferToCloudinary(mp4FileUpload.buffer, 'podcast-mp4', 'video') : Promise.resolve(null),
            ]);

            let projectorVideo = '';

            if (sourceType === 'mp4') {
                // Ek hi mp4 file - iski audio hi bajti hai (<audio> tag video
                // file se bhi sirf audio track decode kar leta hai), aur
                // wahi file khud projector video ban jati hai (visual ke liye).
                audioFile = uploadedMp4Url;
                projectorVideo = uploadedMp4Url;
                image = uploadedImageUrl || '/assets/default-song-cover.svg';
            } else if (sourceType === 'mp3') {
                if (!uploadedAudioUrl) {
                    return res.status(400).json({ message: 'Mp3 file upload is required' });
                }
                audioFile = uploadedAudioUrl;
                image = uploadedImageUrl || '/assets/default-song-cover.svg';
                projectorVideo = projectorEnabled && uploadedVideoUrl ? uploadedVideoUrl : '';
            } else {
                if (!youtubeUrl || !youtubeUrl.trim()) {
                    return res.status(400).json({ message: 'YouTube link is required' });
                }
                youtubeId = extractYoutubeId(youtubeUrl.trim());
                if (!youtubeId) {
                    return res.status(400).json({ message: 'Could not understand this YouTube link, please enter a valid one' });
                }
                image = uploadedImageUrl || youtubeThumbnailUrl(youtubeId);
                projectorVideo = projectorEnabled && uploadedVideoUrl ? uploadedVideoUrl : '';
            }

            let duration = 0;
            if (sourceType === 'mp4' && mp4FileUpload) {
                duration = await getAudioDurationFromBuffer(mp4FileUpload.buffer, mp4FileUpload.mimetype);
            } else if (sourceType === 'mp3' && audioFileUpload) {
                duration = await getAudioDurationFromBuffer(audioFileUpload.buffer, audioFileUpload.mimetype);
            } else if (sourceType === 'youtube' && youtubeId) {
                duration = await getYoutubeDurationSeconds(youtubeId);
            }

            const podcast = await Podcast.create({
                title: title.trim(),
                description: (description || '').trim(),
                category: category.trim(),
                sourceType,
                youtubeId,
                youtubeUrl: sourceType === 'youtube' ? youtubeUrl.trim() : '',
                audioFile,
                image,
                projectorEnabled,
                projectorVideo,
                duration,
                addedBy: req.user._id,
            });

            res.status(201).json({ message: 'Content add ho gaya!', podcast });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Could not add content, please try again' });
        }
    }
);

// ============ EDIT PODCAST (admin only) ============
router.put(
    '/:id',
    requireAuth,
    requireAdmin,
    uploadPodcastFiles,
    async (req, res) => {
        try {
            const podcast = await Podcast.findById(req.params.id);
            if (!podcast) {
                return res.status(404).json({ message: 'Content not found' });
            }

            const { title, description, category, youtubeUrl } = req.body;
            const sourceType = ['mp3', 'mp4', 'youtube'].includes(req.body.sourceType)
                ? req.body.sourceType
                : podcast.sourceType;
            const imageFile = req.files && req.files.image ? req.files.image[0] : null;
            const videoFile = req.files && req.files.projectorVideo ? req.files.projectorVideo[0] : null;
            const audioFileUpload = req.files && req.files.audio ? req.files.audio[0] : null;
            const mp4FileUpload = req.files && req.files.mp4File ? req.files.mp4File[0] : null;

            const [uploadedImageUrl, uploadedVideoUrl, uploadedAudioUrl, uploadedMp4Url] = await Promise.all([
                imageFile ? uploadBufferToCloudinary(imageFile.buffer, 'podcasts', 'image') : Promise.resolve(null),
                videoFile ? uploadBufferToCloudinary(videoFile.buffer, 'podcast-videos', 'video') : Promise.resolve(null),
                audioFileUpload ? uploadBufferToCloudinary(audioFileUpload.buffer, 'podcast-audio', 'video') : Promise.resolve(null),
                mp4FileUpload ? uploadBufferToCloudinary(mp4FileUpload.buffer, 'podcast-mp4', 'video') : Promise.resolve(null),
            ]);

            if (title !== undefined) podcast.title = title.trim();
            if (description !== undefined) podcast.description = description.trim();
            if (category !== undefined) podcast.category = category.trim();

            const hadManualImage = !!podcast.image && podcast.image.startsWith('/uploads/podcasts/');

            if (sourceType !== podcast.sourceType) {
                if (sourceType === 'mp4') {
                    if (!uploadedMp4Url) {
                        return res.status(400).json({ message: 'Mp4 file upload is required' });
                    }
                    podcast.youtubeId = '';
                    podcast.youtubeUrl = '';
                } else if (sourceType === 'mp3') {
                    if (!uploadedAudioUrl && !podcast.audioFile) {
                        return res.status(400).json({ message: 'Mp3 file upload is required' });
                    }
                    podcast.youtubeId = '';
                    podcast.youtubeUrl = '';
                } else {
                    if ((!youtubeUrl || !youtubeUrl.trim()) && !podcast.youtubeUrl) {
                        return res.status(400).json({ message: 'YouTube link is required' });
                    }
                    deleteOldLocalFileIfAny(podcast.audioFile);
                    podcast.audioFile = '';
                }
                podcast.sourceType = sourceType;
            }

            if (sourceType === 'mp4') {
                if (uploadedMp4Url) {
                    deleteOldLocalFileIfAny(podcast.audioFile);
                    podcast.audioFile = uploadedMp4Url;
                    // Mp4 mode mein projector hamesha khud isi file se auto-set hota hai.
                    deleteOldLocalFileIfAny(podcast.projectorVideo);
                    podcast.projectorEnabled = true;
                    podcast.projectorVideo = uploadedMp4Url;
                    podcast.duration = await getAudioDurationFromBuffer(mp4FileUpload.buffer, mp4FileUpload.mimetype);
                }
                if (!imageFile && !hadManualImage && !podcast.image) {
                    podcast.image = '/assets/default-song-cover.svg';
                }
            } else if (sourceType === 'mp3') {
                if (uploadedAudioUrl) {
                    deleteOldLocalFileIfAny(podcast.audioFile);
                    podcast.audioFile = uploadedAudioUrl;
                    podcast.duration = await getAudioDurationFromBuffer(audioFileUpload.buffer, audioFileUpload.mimetype);
                }
                if (!imageFile && !hadManualImage && !podcast.image) {
                    podcast.image = '/assets/default-song-cover.svg';
                }
            } else if (youtubeUrl !== undefined && youtubeUrl.trim() !== '') {
                const youtubeId = extractYoutubeId(youtubeUrl.trim());
                if (!youtubeId) {
                    return res.status(400).json({ message: 'Could not understand this YouTube link, please enter a valid one' });
                }
                if (youtubeId !== podcast.youtubeId) {
                    podcast.duration = await getYoutubeDurationSeconds(youtubeId);
                }
                podcast.youtubeId = youtubeId;
                podcast.youtubeUrl = youtubeUrl.trim();
                if (!imageFile && !hadManualImage) {
                    podcast.image = youtubeThumbnailUrl(youtubeId);
                }
            }

            if (uploadedImageUrl) {
                if (hadManualImage) {
                    deleteOldLocalFileIfAny(podcast.image);
                }
                podcast.image = uploadedImageUrl;
            }

            // Mp4 mode ke ilawa - projector ka normal (manual yes/no) toggle
            if (sourceType !== 'mp4' && req.body.projectorEnabled !== undefined) {
                const projectorEnabled = parseBoolean(req.body.projectorEnabled);

                if (!projectorEnabled) {
                    deleteOldLocalFileIfAny(podcast.projectorVideo);
                    podcast.projectorEnabled = false;
                    podcast.projectorVideo = '';
                } else if (uploadedVideoUrl) {
                    deleteOldLocalFileIfAny(podcast.projectorVideo);
                    podcast.projectorEnabled = true;
                    podcast.projectorVideo = uploadedVideoUrl;
                } else if (!podcast.projectorVideo) {
                    return res.status(400).json({ message: 'Projector video is ON - please upload a video file' });
                } else {
                    podcast.projectorEnabled = true;
                }
            }

            await podcast.save();
            res.json({ message: 'Content update ho gaya!', podcast });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Could not update content' });
        }
    }
);

// ============ DELETE PODCAST (admin only) ============
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const podcast = await Podcast.findByIdAndDelete(req.params.id);
        if (!podcast) {
            return res.status(404).json({ message: 'Content not found' });
        }
        deleteOldLocalFileIfAny(podcast.projectorVideo);
        deleteOldLocalFileIfAny(podcast.audioFile);
        res.json({ message: 'Content delete ho gaya' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not delete content' });
    }
});

module.exports = router;
