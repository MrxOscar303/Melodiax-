const express = require('express');
const rateLimit = require('express-rate-limit');

const DownloadRecord = require('../models/DownloadRecord');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { message: 'Too many requests, please slow down.' },
});

function serialize(doc) {
    return {
        id: doc.songId,
        name: doc.name || '',
        image: doc.image || '',
        desc: doc.desc || '',
        downloadedAt: doc.downloadedAt || Date.now(),
    };
}

// ============ LIST (account ki poori "downloaded" list) ============
router.get('/', requireAuth, async (req, res) => {
    try {
        const records = await DownloadRecord.find({ owner: req.user._id }).sort({ downloadedAt: -1 });
        res.json({ downloads: records.map(serialize) });
    } catch (err) {
        console.error('List downloads error:', err);
        res.status(500).json({ message: 'Server error while fetching downloads.' });
    }
});

// ============ MARK AS DOWNLOADED (upsert) ============
router.post('/', requireAuth, writeLimiter, async (req, res) => {
    try {
        const { id, name, image, desc } = req.body;
        if (!id) return res.status(400).json({ message: 'Song id is required.' });
        const record = await DownloadRecord.findOneAndUpdate(
            { owner: req.user._id, songId: String(id) },
            {
                $set: { name: name || '', image: image || '', desc: desc || '' },
                $setOnInsert: { downloadedAt: Date.now() },
            },
            { upsert: true, new: true }
        );
        res.status(201).json({ download: serialize(record) });
    } catch (err) {
        console.error('Mark download error:', err);
        res.status(500).json({ message: 'Server error while saving download.' });
    }
});

// ============ REMOVE ============
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        await DownloadRecord.deleteOne({ owner: req.user._id, songId: req.params.id });
        res.json({ message: 'Removed.' });
    } catch (err) {
        console.error('Delete download error:', err);
        res.status(500).json({ message: 'Server error while removing download.' });
    }
});

module.exports = router;
