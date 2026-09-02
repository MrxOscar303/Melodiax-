const express = require('express');
const rateLimit = require('express-rate-limit');

const UserPlaylist = require('../models/UserPlaylist');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Spam se bachne ke liye.
const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    message: { message: 'Too many requests, please slow down.' },
});

// Frontend (playlist.js) hamesha `id` field expect karta hai (pehle
// localStorage me client-generated string id hoti thi) - ab MongoDB ka
// `_id` hi wahi kaam karta hai, bas naam `id` (string) me map kar dete hain.
function serialize(doc) {
    return {
        id: String(doc._id),
        name: doc.name,
        image: doc.image || null,
        songs: (doc.songs || []).map((s) => ({ id: s.id, addedAt: s.addedAt })),
        createdAt: doc.createdAt ? doc.createdAt.getTime() : Date.now(),
        autoSection: doc.autoSection || undefined,
    };
}

// ============ LIST (sirf apni playlists) ============
router.get('/', requireAuth, async (req, res) => {
    try {
        const playlists = await UserPlaylist.find({ owner: req.user._id }).sort({ createdAt: 1 });
        res.json({ playlists: playlists.map(serialize) });
    } catch (err) {
        console.error('List user playlists error:', err);
        res.status(500).json({ message: 'Server error while fetching playlists.' });
    }
});

// ============ CREATE ============
router.post('/', requireAuth, writeLimiter, async (req, res) => {
    try {
        const { name, image, songs, autoSection } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ message: 'Playlist name is required.' });
        }
        if (!Array.isArray(songs) || !songs.length) {
            return res.status(400).json({ message: 'Please select at least one song.' });
        }
        const playlist = await UserPlaylist.create({
            owner: req.user._id,
            name: name.trim().slice(0, 100),
            image: image || null,
            songs: songs.map((s) => ({ id: String(s.id), addedAt: Number(s.addedAt) || Date.now() })),
            autoSection: autoSection || null,
        });
        res.status(201).json({ playlist: serialize(playlist) });
    } catch (err) {
        console.error('Create user playlist error:', err);
        res.status(500).json({ message: 'Server error while creating playlist.' });
    }
});

// ============ UPDATE (name/image/songs) ============
router.patch('/:id', requireAuth, writeLimiter, async (req, res) => {
    try {
        const playlist = await UserPlaylist.findOne({ _id: req.params.id, owner: req.user._id });
        if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });

        const { name, image, songs, autoSection } = req.body;
        if (typeof name === 'string' && name.trim()) playlist.name = name.trim().slice(0, 100);
        if (image !== undefined) playlist.image = image || null;
        if (Array.isArray(songs)) {
            playlist.songs = songs.map((s) => ({ id: String(s.id), addedAt: Number(s.addedAt) || Date.now() }));
        }
        if (autoSection !== undefined) playlist.autoSection = autoSection || null;
        await playlist.save();
        res.json({ playlist: serialize(playlist) });
    } catch (err) {
        console.error('Update user playlist error:', err);
        res.status(500).json({ message: 'Server error while updating playlist.' });
    }
});

// ============ DELETE ============
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const playlist = await UserPlaylist.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
        if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
        res.json({ message: 'Playlist deleted.' });
    } catch (err) {
        console.error('Delete user playlist error:', err);
        res.status(500).json({ message: 'Server error while deleting playlist.' });
    }
});

module.exports = router;
