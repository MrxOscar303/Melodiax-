const express = require('express');

const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ============ LIST (newest first) ============
router.get('/', requireAuth, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .populate('fromUser', 'username profilePicture')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            notifications: notifications.map((n) => ({
                id: n._id,
                type: n.type,
                message: n.message,
                read: n.read,
                createdAt: n.createdAt,
                fromUser: n.fromUser
                    ? { id: n.fromUser._id, username: n.fromUser.username, profilePicture: n.fromUser.profilePicture }
                    : null,
            })),
            muted: req.user.notificationsMuted === true,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load notifications.' });
    }
});

// ============ UNREAD COUNT (polling ke liye halka endpoint) ============
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user: req.user._id, read: false });
        res.json({ count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load unread count.' });
    }
});

// ============ MARK ONE READ ============
router.patch('/:id/read', requireAuth, async (req, res) => {
    try {
        await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
        res.json({ message: 'Marked as read.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update notification.' });
    }
});

// ============ MARK ALL READ ============
router.patch('/read-all', requireAuth, async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
        res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update notifications.' });
    }
});

// ============ MUTE / UNMUTE ============
router.patch('/mute', requireAuth, async (req, res) => {
    try {
        req.user.notificationsMuted = req.body.muted === true;
        await req.user.save();
        res.json({ muted: req.user.notificationsMuted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update notification settings.' });
    }
});

module.exports = router;
