const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;

const Playlist = require('../models/Playlist');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Buffer (memory mein aayi hui file) ko seedha Cloudinary par upload karta hai
// - koi bhi hosting ho (jahan disk persist nahi hota, jaise Render), ye
// hamesha kaam karega, kyunki image kabhi local disk par save hi nahi hoti.
function uploadBufferToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `melodiax/${folder}`, resource_type: 'image' },
            (err, result) => {
                if (err) return reject(err);
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}

// Purani entry agar local "/uploads/..." path thi (Cloudinary lagane se
// pehle ki) to use disk se hatane ki koshish karta hai - Cloudinary URLs
// (https se shuru) ke liye kuch nahi karta, kyunke wo disk pe hain hi nahi.
function deleteOldLocalFileIfAny(relativePath) {
    if (relativePath && relativePath.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', 'public', relativePath);
        fs.unlink(oldPath, () => {});
    }
}

// ---------- Playlist banner cover image upload (Multer) ----------
// Files ab disk par save nahi hoti - memory mein rakhi jaati hain, phir
// seedha Cloudinary par upload hoti hain (neeche routes mein). Isse hosting
// par restart/redeploy hone par bhi images "gayab" nahi hongi.
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        return cb(new Error('Only image files (jpg, png, webp, gif) allowed hain'));
    },
});

// Bulk misuse se bachne ke liye - songs wale limiter jaisa hi
const playlistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many attempts have occurred, please try again after a while.' },
});

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// ============ LIST ALL BANNER SLIDES (public - homepage carousel ye load karta hai) ============
router.get('/', async (req, res) => {
    try {
        const playlists = await Playlist.find().sort({ order: 1, createdAt: 1 });
        res.json({ playlists });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load playlists' });
    }
});

// ============ ADD BANNER SLIDE (admin only) ============
router.post('/', requireAuth, requireAdmin, playlistLimiter, upload.single('image'), async (req, res) => {
    try {
        const { title, description, bgColor, linkedSection, order } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Title is required' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'Playlist cover image is required' });
        }

        const color = (bgColor || '').trim();
        if (color && !HEX_COLOR_RE.test(color)) {
            return res.status(400).json({ message: 'Background color must be a valid hex code' });
        }

        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, 'playlists');

        const playlist = await Playlist.create({
            title: title.trim(),
            description: (description || '').trim(),
            image: imageUrl,
            bgColor: color || '#2563eb',
            linkedSection: (linkedSection || '').trim(),
            order: Number.isFinite(Number(order)) ? Number(order) : 0,
            createdBy: req.user._id,
        });

        res.status(201).json({ message: 'Playlist banner add ho gaya!', playlist });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not add playlist, please try again' });
    }
});

// ============ EDIT BANNER SLIDE (admin only) ============
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        const { title, description, bgColor, linkedSection, order } = req.body;

        if (title !== undefined) {
            if (!title.trim()) return res.status(400).json({ message: 'Title cannot be empty' });
            playlist.title = title.trim();
        }
        if (description !== undefined) playlist.description = description.trim();
        if (linkedSection !== undefined) playlist.linkedSection = linkedSection.trim();
        if (order !== undefined && order !== '' && Number.isFinite(Number(order))) {
            playlist.order = Number(order);
        }

        if (bgColor !== undefined && bgColor.trim() !== '') {
            const color = bgColor.trim();
            if (!HEX_COLOR_RE.test(color)) {
                return res.status(400).json({ message: 'Background color must be a valid hex code' });
            }
            playlist.bgColor = color;
        }

        if (req.file) {
            // Purani cover image - Cloudinary par hai to wahin se hata dein,
            // agar (purani/pre-Cloudinary) local file hai to disk se hata dein.
            deleteOldLocalFileIfAny(playlist.image);
            playlist.image = await uploadBufferToCloudinary(req.file.buffer, 'playlists');
        }

        await playlist.save();
        res.json({ message: 'Playlist banner update ho gaya!', playlist });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update playlist' });
    }
});

// ============ DELETE BANNER SLIDE (admin only) ============
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const playlist = await Playlist.findByIdAndDelete(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }
        deleteOldLocalFileIfAny(playlist.image);
        res.json({ message: 'Playlist banner delete ho gaya' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not delete playlist' });
    }
});

module.exports = router;
