const express = require('express');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Spam se bachne ke liye - request bhejna/search karna rate-limited
const actionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { message: 'Too many requests, please slow down.' },
});

function publicFriendUser(user) {
    return {
        id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        // "invisible" khud user ke apne account me hi sahi dikhta hai -
        // doosron ke liye ye hamesha "offline" jaisa hi nazar aata hai
        // (Discord jaisa hi behavior - is liye "Invisible" kehte hain).
        status: user.status === 'invisible' ? 'offline' : (user.status || 'online'),
        statusMessage: user.status === 'invisible' ? '' : (user.statusMessage || ''),
    };
}

// ============ SEARCH USERS (by @username) ============
router.get('/search', requireAuth, actionLimiter, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.json({ users: [] });

        const users = await User.find({
            _id: { $ne: req.user._id },
            username: { $regex: q, $options: 'i' },
        })
            .limit(10)
            .select('username profilePicture status statusMessage');

        res.json({ users: users.map(publicFriendUser) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Search failed, please try again.' });
    }
});

// ============ SEND FRIEND REQUEST ============
router.post('/request', requireAuth, actionLimiter, async (req, res) => {
    try {
        const username = (req.body.username || '').trim().replace(/^@/, '');
        if (!username) return res.status(400).json({ message: 'Please enter a username.' });

        const target = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (!target) return res.status(404).json({ message: 'No user found with that username.' });
        if (target._id.equals(req.user._id)) {
            return res.status(400).json({ message: "You can't add yourself as a friend." });
        }

        const existing = await Friendship.findOne({
            $or: [
                { requester: req.user._id, recipient: target._id },
                { requester: target._id, recipient: req.user._id },
            ],
        });
        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ message: 'You are already friends.' });
            }
            return res.status(400).json({ message: 'A friend request is already pending.' });
        }

        await Friendship.create({ requester: req.user._id, recipient: target._id, status: 'pending' });

        if (!target.notificationsMuted) {
            await Notification.create({
                user: target._id,
                type: 'friend_request',
                fromUser: req.user._id,
                message: `@${req.user.username} sent you a friend request.`,
            });
        }

        res.json({ message: `Friend request sent to @${target.username}.` });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'A friend request is already pending.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Could not send friend request, please try again.' });
    }
});

// ============ INCOMING PENDING REQUESTS ============
router.get('/requests', requireAuth, async (req, res) => {
    try {
        const requests = await Friendship.find({ recipient: req.user._id, status: 'pending' })
            .populate('requester', 'username profilePicture status statusMessage')
            .sort({ createdAt: -1 });

        res.json({
            requests: requests.map((r) => ({
                id: r._id,
                from: publicFriendUser(r.requester),
                createdAt: r.createdAt,
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load friend requests.' });
    }
});

// ============ ACCEPT REQUEST ============
router.post('/requests/:id/accept', requireAuth, async (req, res) => {
    try {
        const request = await Friendship.findOne({ _id: req.params.id, recipient: req.user._id, status: 'pending' });
        if (!request) return res.status(404).json({ message: 'Friend request not found.' });

        request.status = 'accepted';
        await request.save();

        const requesterUser = await User.findById(request.requester);
        if (requesterUser && !requesterUser.notificationsMuted) {
            await Notification.create({
                user: requesterUser._id,
                type: 'friend_accept',
                fromUser: req.user._id,
                message: `@${req.user.username} accepted your friend request.`,
            });
        }

        res.json({ message: 'Friend request accepted.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not accept friend request.' });
    }
});

// ============ DECLINE REQUEST ============
router.post('/requests/:id/decline', requireAuth, async (req, res) => {
    try {
        const request = await Friendship.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user._id,
            status: 'pending',
        });
        if (!request) return res.status(404).json({ message: 'Friend request not found.' });
        res.json({ message: 'Friend request declined.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not decline friend request.' });
    }
});

// ============ FRIENDS LIST ============
router.get('/', requireAuth, async (req, res) => {
    try {
        const friendships = await Friendship.find({
            status: 'accepted',
            $or: [{ requester: req.user._id }, { recipient: req.user._id }],
        })
            .populate('requester', 'username profilePicture status statusMessage')
            .populate('recipient', 'username profilePicture status statusMessage');

        const friends = friendships.map((f) => {
            const other = f.requester._id.equals(req.user._id) ? f.recipient : f.requester;
            return { friendshipId: f._id, ...publicFriendUser(other) };
        });

        res.json({ friends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load friends list.' });
    }
});

// ============ REMOVE FRIEND ============
router.delete('/:friendshipId', requireAuth, async (req, res) => {
    try {
        const friendship = await Friendship.findOneAndDelete({
            _id: req.params.friendshipId,
            status: 'accepted',
            $or: [{ requester: req.user._id }, { recipient: req.user._id }],
        });
        if (!friendship) return res.status(404).json({ message: 'Friend not found.' });
        res.json({ message: 'Friend removed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not remove friend.' });
    }
});

// ============ UPDATE MY STATUS (Online / Do Not Disturb / Night + custom message) ============
router.patch('/status/me', requireAuth, async (req, res) => {
    try {
        const { status, statusMessage } = req.body;
        if (status && !['online', 'dnd', 'night', 'invisible'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }
        if (status) req.user.status = status;
        if (typeof statusMessage === 'string') req.user.statusMessage = statusMessage.slice(0, 60);
        await req.user.save();
        res.json({ status: req.user.status, statusMessage: req.user.statusMessage });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update status.' });
    }
});

module.exports = router;
