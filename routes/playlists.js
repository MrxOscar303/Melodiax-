const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const Playlist = require('../models/Playlist');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ---------- Playlist banner cover image upload (Multer) ----------
const playlistImageDir = path.join(__dirname, '..', 'public', 'uploads', 'playlists');
if (!fs.existsSync(playlistImageDir)) fs.mkdirSync(playlistImageDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, playlistImageDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

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
        res.status(500).json({ message: 'Playlists load nahi ho sakin' });
    }
});

// ============ ADD BANNER SLIDE (admin only) ============
router.post('/', requireAuth, requireAdmin, playlistLimiter, upload.single('image'), async (req, res) => {
    try {
        const { title, description, bgColor, linkedSection, order } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Title zaroori hai' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'Playlist ki cover image zaroori hai' });
        }

        const color = (bgColor || '').trim();
        if (color && !HEX_COLOR_RE.test(color)) {
            return res.status(400).json({ message: 'Background color valid hex code honi chahiye' });
        }

        const playlist = await Playlist.create({
            title: title.trim(),
            description: (description || '').trim(),
            image: `/uploads/playlists/${req.file.filename}`,
            bgColor: color || '#2563eb',
            linkedSection: (linkedSection || '').trim(),
            order: Number.isFinite(Number(order)) ? Number(order) : 0,
            createdBy: req.user._id,
        });

        res.status(201).json({ message: 'Playlist banner add ho gaya!', playlist });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Playlist add nahi ho saka, dobara try karein' });
    }
});

// ============ EDIT BANNER SLIDE (admin only) ============
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Ye playlist nahi mili' });
        }

        const { title, description, bgColor, linkedSection, order } = req.body;

        if (title !== undefined) {
            if (!title.trim()) return res.status(400).json({ message: 'Title khaali nahi ho sakta' });
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
                return res.status(400).json({ message: 'Background color valid hex code honi chahiye' });
            }
            playlist.bgColor = color;
        }

        if (req.file) {
            // Purani cover image disk se hata dein
            const oldPath = path.join(__dirname, '..', 'public', playlist.image);
            fs.unlink(oldPath, () => {});
            playlist.image = `/uploads/playlists/${req.file.filename}`;
        }

        await playlist.save();
        res.json({ message: 'Playlist banner update ho gaya!', playlist });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Playlist update nahi ho saka' });
    }
});

// ============ DELETE BANNER SLIDE (admin only) ============
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const playlist = await Playlist.findByIdAndDelete(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Ye playlist nahi mili' });
        }
        if (playlist.image) {
            const imgPath = path.join(__dirname, '..', 'public', playlist.image);
            fs.unlink(imgPath, () => {});
        }
        res.json({ message: 'Playlist banner delete ho gaya' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Playlist delete nahi ho saka' });
    }
});

module.exports = router;
