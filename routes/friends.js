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

// Agar is der tak koi "heartbeat" na aaye (tab/app band ho chuka, ya
// internet chala gaya), to doosron ko wo user "offline" dikhta hai -
// chahe uska stored status kuch bhi ho.
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minute

function isRecentlyActive(user) {
    if (!user.lastActiveAt) return false;
    return (Date.now() - new Date(user.lastActiveAt).getTime()) < ACTIVE_THRESHOLD_MS;
}

// Agar status ek waqt ke liye set kiya gaya tha (jaise "30 minute ke liye
// DND") aur wo waqt guzar chuka hai, to status wapas "online" par le aata
// hai aur save kar deta hai. Har jagah call karna safe hai (no-op agar
// expiry set hi nahi).
async function revertExpiredStatus(user) {
    if (user.statusExpiresAt && new Date(user.statusExpiresAt) <= new Date()) {
        user.status = 'online';
        user.statusExpiresAt = undefined;
        await user.save();
    }
}

function publicFriendUser(user) {
    let status = user.status || 'online';
    if (status === 'invisible') {
        status = 'offline'; // khud ke liye "Invisible" hi rehta hai, doosron ko "offline" dikhta hai
    } else if (!isRecentlyActive(user)) {
        status = 'offline'; // device/tab band hai (heartbeat rukk gaya)
    }
    return {
        id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        status,
        statusMessage: (user.status === 'invisible' || status === 'offline') ? '' : (user.statusMessage || ''),
        profileEffect: user.profileEffect || 'none',
    };
}

const FRIEND_SELECT_FIELDS = 'username profilePicture status statusMessage lastActiveAt profileEffect';

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
            .select(FRIEND_SELECT_FIELDS);

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
            .populate('requester', FRIEND_SELECT_FIELDS)
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
            .populate('requester', FRIEND_SELECT_FIELDS)
            .populate('recipient', FRIEND_SELECT_FIELDS);

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

// ============ HEARTBEAT ============
// Har 30 second (frontend se) jab tak tab khuli/focused hai - isse
// lastActiveAt taaza rehta hai. Agar ye aana ruk jaye (tab/app band, ya
// internet chala gaya), kuch hi minute mein user doosron ko "offline"
// dikhne lagta hai (upar wala ACTIVE_THRESHOLD_MS dekhein) - alag se
// "logout"/"disconnect" detect karne ki zaroorat nahi.
router.post('/heartbeat', requireAuth, async (req, res) => {
    try {
        req.user.lastActiveAt = new Date();
        await revertExpiredStatus(req.user); // isi call mein expiry bhi check kar lete hain
        if (!req.user.isModified()) await req.user.save();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false });
    }
});

// ============ UPDATE MY STATUS (Online / Do Not Disturb / Idle / Invisible + custom message + duration) ============
router.patch('/status/me', requireAuth, async (req, res) => {
    try {
        const { status, statusMessage, durationMinutes } = req.body;
        if (status && !['online', 'dnd', 'night', 'invisible'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        await revertExpiredStatus(req.user); // purani expiry (agar guzar chuki ho) pehle clear kar lo

        if (status) {
            req.user.status = status;
            // durationMinutes: 0/undefined = "jab tak khud na badlein" (koi expiry nahi)
            if (durationMinutes && Number(durationMinutes) > 0) {
                req.user.statusExpiresAt = new Date(Date.now() + Number(durationMinutes) * 60 * 1000);
            } else {
                req.user.statusExpiresAt = undefined;
            }
        }
        if (typeof statusMessage === 'string') req.user.statusMessage = statusMessage.slice(0, 60);

        req.user.lastActiveAt = new Date(); // status badalna khud ek "active hone" ka sign hai
        await req.user.save();
        res.json({ status: req.user.status, statusMessage: req.user.statusMessage, statusExpiresAt: req.user.statusExpiresAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update status.' });
    }
});

module.exports = router;
