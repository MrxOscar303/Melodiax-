const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Message = require('../models/Message');
const Friendship = require('../models/Friendship');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

const sendLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { message: 'You are sending messages too fast, please slow down.' },
});

// ---------- Voice message upload (Multer) ----------
const voiceDir = path.join(__dirname, '..', 'public', 'uploads', 'voice');
if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

const voiceStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, voiceDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}.webm`);
    },
});
const uploadVoice = multer({
    storage: voiceStorage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB - kaafi minutes ki compressed voice note ke liye
    fileFilter: (req, file, cb) => {
        const allowed = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only audio files are allowed'));
    },
});

// Sirf accepted friends ko hi ek doosre ko message karne dena hai.
async function areFriends(userA, userB) {
    const friendship = await Friendship.findOne({
        status: 'accepted',
        $or: [
            { requester: userA, recipient: userB },
            { requester: userB, recipient: userA },
        ],
    });
    return !!friendship;
}

function serializeMessage(m, currentUserId) {
    return {
        id: m._id,
        type: m.type || 'text',
        content: m.content,
        voiceDuration: m.voiceDuration,
        mine: m.sender.equals(currentUserId),
        createdAt: m.createdAt,
        read: m.read,
    };
}

// ============ CONVERSATION HISTORY (with a specific friend) ============
router.get('/:friendId', requireAuth, async (req, res) => {
    try {
        const { friendId } = req.params;
        if (!(await areFriends(req.user._id, friendId))) {
            return res.status(403).json({ message: 'You can only view messages with your friends.' });
        }

        const messages = await Message.find({
            $or: [
                { sender: req.user._id, recipient: friendId },
                { sender: friendId, recipient: req.user._id },
            ],
        })
            .sort({ createdAt: 1 })
            .limit(200);

        // Doosre ki bheji hui unread messages ko "read" mark kar do (chat khol li gayi hai).
        await Message.updateMany(
            { sender: friendId, recipient: req.user._id, read: false },
            { $set: { read: true } }
        );

        res.json({ messages: messages.map((m) => serializeMessage(m, req.user._id)) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load messages.' });
    }
});

// ============ SEND MESSAGE (text / gif / sticker) ============
router.post('/', requireAuth, sendLimiter, async (req, res) => {
    try {
        const { to, content, type } = req.body;
        const msgType = ['text', 'gif', 'sticker'].includes(type) ? type : 'text';

        if (!to || !content || !String(content).trim()) {
            return res.status(400).json({ message: 'A recipient and message content are required.' });
        }
        if (!(await areFriends(req.user._id, to))) {
            return res.status(403).json({ message: 'You can only message your friends.' });
        }

        // gif = Giphy URL (thora lamba ho sakta hai), sticker = ek emoji
        // character (chhota), text = normal message.
        const maxLen = msgType === 'gif' ? 500 : msgType === 'sticker' ? 20 : 2000;

        const message = await Message.create({
            sender: req.user._id,
            recipient: to,
            type: msgType,
            content: String(content).trim().slice(0, maxLen),
        });

        res.status(201).json({ message: serializeMessage(message, req.user._id) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not send message, please try again.' });
    }
});

// ============ SEND VOICE MESSAGE ============
router.post('/voice', requireAuth, sendLimiter, uploadVoice.single('audio'), async (req, res) => {
    try {
        const { to, duration } = req.body;
        if (!to || !req.file) {
            return res.status(400).json({ message: 'A recipient and an audio recording are required.' });
        }
        if (!(await areFriends(req.user._id, to))) {
            return res.status(403).json({ message: 'You can only message your friends.' });
        }

        const message = await Message.create({
            sender: req.user._id,
            recipient: to,
            type: 'voice',
            content: `/uploads/voice/${req.file.filename}`,
            voiceDuration: duration ? Math.round(Number(duration)) : undefined,
        });

        res.status(201).json({ message: serializeMessage(message, req.user._id) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not send voice message, please try again.' });
    }
});

module.exports = router;
