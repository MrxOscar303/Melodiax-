const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const cloudinary = require('cloudinary').v2;

const PremiumPlan = require('../models/PremiumPlan');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Buffer (memory mein aayi hui file) ko seedha Cloudinary par upload karta hai
// - playlists.js jaisa hi pattern (koi bhi hosting ho, image kabhi local
// disk par save hi nahi hoti).
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

// ---------- Premium plan cover image upload (Multer) ----------
// Crown icon ki jagah dikhne wali chhoti cover image - optional hai, isliye
// (playlist banner ke unlike) na hone par bhi form submit ho sakta hai.
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

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Bulk misuse se bachne ke liye - baaki admin panels jaisa hi limiter
const premiumLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many attempts have occurred, please try again after a while.' },
});

// "String, ek line = ek feature" wale textarea input ko clean array mein badalta hai.
function parseFeatures(raw) {
    if (Array.isArray(raw)) {
        return raw.map((f) => String(f).trim()).filter(Boolean).slice(0, 20);
    }
    if (typeof raw === 'string') {
        return raw
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean)
            .slice(0, 20);
    }
    return [];
}

// Default plans - server pehli baar chalte waqt (agar database mein abhi
// tak koi plan na ho) khud-ba-khud add ho jate hain, taake Premium tab
// khaali na dikhe. Admin inhe baad mein edit/delete/replace kar sakta hai.
const DEFAULT_PLANS = [
    {
        name: 'Silver',
        price: 'RM12.90/mo',
        tagline: 'A light, ad-free starting point',
        features: ['Ad-free listening', 'Standard audio quality', 'Unlimited skips'],
        color: '#9ea7b3',
        order: 1,
    },
    {
        name: 'Gold',
        price: 'RM25.90/mo',
        tagline: 'Our most popular everyday plan',
        features: ['Everything in Silver', 'High audio quality', 'Offline downloads', 'Custom playlists'],
        color: '#e5b93a',
        badge: 'Most Popular',
        order: 2,
    },
    {
        name: 'Diamond',
        price: 'RM42.90/mo',
        tagline: 'For listeners who want it all',
        features: ['Everything in Gold', 'Lossless audio quality', 'Early access to new songs', 'Priority support'],
        color: '#4fc3d9',
        order: 3,
    },
    {
        name: 'Platinum',
        price: 'RM64.90/mo',
        tagline: 'The ultimate Melodiax experience',
        features: ['Everything in Diamond', 'Family sharing (up to 5)', 'Exclusive content', 'Dedicated support line'],
        color: '#b9a5e3',
        order: 4,
    },
];

// Server start hote hi ek dafa check kar leta hai - agar koi plan maujood
// nahi to default 4 plans insert kar deta hai. Mongoose apni operations
// khud buffer kar leta hai jab tak connection ban nahi jaati, is liye ye
// yahan module load ke waqt hi call karna safe hai.
async function ensureDefaultPlans() {
    try {
        const count = await PremiumPlan.countDocuments();
        if (count === 0) {
            await PremiumPlan.insertMany(DEFAULT_PLANS);
            console.log('✅ Default Premium plans seeded (Silver/Gold/Diamond/Platinum)');
        }
    } catch (err) {
        console.error('Premium plan seeding failed:', err.message);
    }
}
ensureDefaultPlans();

// ============ LIST ALL PLANS (public - Premium tab ye load karta hai) ============
router.get('/', async (req, res) => {
    try {
        const plans = await PremiumPlan.find().sort({ order: 1, createdAt: 1 });
        res.json({ plans });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not load premium plans' });
    }
});

// ============ ADD PLAN (admin only) ============
router.post('/', requireAuth, requireAdmin, premiumLimiter, upload.single('image'), async (req, res) => {
    try {
        const { name, price, tagline, features, color, badge, order } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Plan name is required' });
        }

        const chosenColor = (color || '').trim();
        if (chosenColor && !HEX_COLOR_RE.test(chosenColor)) {
            return res.status(400).json({ message: 'Theme color must be a valid hex code' });
        }

        // Cover image optional hai - agar upload hui hai to Cloudinary par
        // bhej dete hain, warna crown icon hi fallback ke tor par dikhta rahega.
        const imageUrl = req.file ? await uploadBufferToCloudinary(req.file.buffer, 'premium') : '';

        const plan = await PremiumPlan.create({
            name: name.trim(),
            price: (price || '').trim(),
            tagline: (tagline || '').trim(),
            features: parseFeatures(features),
            color: chosenColor || '#1db954',
            image: imageUrl,
            badge: (badge || '').trim(),
            order: Number.isFinite(Number(order)) ? Number(order) : 0,
            createdBy: req.user._id,
        });

        res.status(201).json({ message: 'Premium plan add ho gaya!', plan });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not add premium plan, please try again' });
    }
});

// ============ EDIT PLAN (admin only) ============
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const plan = await PremiumPlan.findById(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Premium plan not found' });
        }

        const { name, price, tagline, features, color, badge, order } = req.body;

        if (name !== undefined) {
            if (!name.trim()) return res.status(400).json({ message: 'Plan name cannot be empty' });
            plan.name = name.trim();
        }
        if (price !== undefined) plan.price = price.trim();
        if (tagline !== undefined) plan.tagline = tagline.trim();
        if (badge !== undefined) plan.badge = badge.trim();
        if (features !== undefined) plan.features = parseFeatures(features);
        if (order !== undefined && order !== '' && Number.isFinite(Number(order))) {
            plan.order = Number(order);
        }
        if (color !== undefined && color.trim() !== '') {
            const chosenColor = color.trim();
            if (!HEX_COLOR_RE.test(chosenColor)) {
                return res.status(400).json({ message: 'Theme color must be a valid hex code' });
            }
            plan.color = chosenColor;
        }
        if (req.file) {
            plan.image = await uploadBufferToCloudinary(req.file.buffer, 'premium');
        }

        await plan.save();
        res.json({ message: 'Premium plan update ho gaya!', plan });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not update premium plan' });
    }
});

// ============ DELETE PLAN (admin only) ============
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const plan = await PremiumPlan.findByIdAndDelete(req.params.id);
        if (!plan) {
            return res.status(404).json({ message: 'Premium plan not found' });
        }
        res.json({ message: 'Premium plan delete ho gaya' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not delete premium plan' });
    }
});

module.exports = router;
