const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const passport = require('passport');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendVerificationEmail } = require('../utils/mailer');

const router = express.Router();

// ---------- Profile picture upload (Multer) ----------
const avatarDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only Images Files (jpg, png, webp, gif) allowed hain'));
    },
});

// Signup/login pe brute-force se bachne ke liye rate limit
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { message: 'Too many attempts have occurred, please try again after a while.' },
});

// ---------- Helpers ----------
function signToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
}

function sendAuthCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true, // JavaScript se access nahi ho sakti (XSS se safe)
        secure: process.env.NODE_ENV === 'production', // production mein sirf HTTPS
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 din - isi wajah se device par dobara login nahi maangega
    });
}

function publicUser(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        authProvider: user.authProvider,
        isAdmin: user.isAdmin === true,
        isVerified: user.isVerified === true,
    };
}

// Naya verification token banata hai, user par save karta hai, aur email bhejta hai.
async function issueVerificationEmail(user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 ghante
    await user.save();

    const verifyUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    await sendVerificationEmail(user.email, user.username, verifyUrl);
}

// ============ SIGNUP ============
router.post('/signup', authLimiter, upload.single('profilePicture'), async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (existing) {
            return res.status(409).json({
                message:
                    existing.email === email.toLowerCase()
                        ? 'This email is already registered'
                        : 'This username has already been taken',
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Agar user ne picture nahi di to default avatar automatically use hoga (model ka default)
        const profilePicture = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            ...(profilePicture && { profilePicture }),
        });

        await issueVerificationEmail(user);

        // NOTE: yahan login cookie nahi di jaati - jab tak email verify nahi
        // hoti, account "pending" rehta hai (login route usko block karega).
        res.status(201).json({
            message: 'Account create ho gaya! Apna inbox check karein aur verification link par click karke email confirm karein.',
            requiresVerification: true,
            email: user.email,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'There was a problem during signup, please try again' });
    }
});

// ============ VERIFY EMAIL (signup ke link se click hota hai) ============
router.get('/verify-email', async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.redirect('/?verify=missing');
        }

        const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');
        const user = await User.findOne({
            email: String(email).toLowerCase(),
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() },
        }).select('+emailVerificationToken +emailVerificationExpires');

        if (!user) {
            return res.redirect(`/?verify=invalid&email=${encodeURIComponent(email)}`);
        }

        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        return res.redirect('/?verify=success');
    } catch (err) {
        console.error(err);
        return res.redirect('/?verify=error');
    }
});

// ============ RESEND VERIFICATION EMAIL ============
router.post('/resend-verification', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email zaroori hai' });

        const user = await User.findOne({ email: email.toLowerCase() });
        // Privacy ke liye hamesha same generic message - taake pata na chale
        // ke koi email registered hai ya nahi.
        const generic = { message: 'Agar ye email registered hai to verification link bhej diya gaya hai.' };
        if (!user || user.isVerified || user.authProvider !== 'local') {
            return res.json(generic);
        }

        await issueVerificationEmail(user);
        res.json(generic);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Kuch masla ho gaya, dobara try karein' });
    }
});

// ============ LOGIN ============
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;
        if (!emailOrUsername || !password) {
            return res.status(400).json({ message: 'Please provide email/username and password' });
        }

        const user = await User.findOne({
            $or: [{ email: emailOrUsername.toLowerCase() }, { username: emailOrUsername }],
        }).select('+password');

        if (!user || !user.password) {
            return res.status(401).json({ message: 'Incorrect email/username or password' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Incorrect email/username or password' });
        }

        if (user.authProvider === 'local' && !user.isVerified) {
            return res.status(403).json({
                message: 'Login se pehle apna email verify karna zaroori hai. Inbox check karein ya verification email dobara bhejwayein.',
                requiresVerification: true,
                email: user.email,
            });
        }

        const token = signToken(user._id);
        sendAuthCookie(res, token);

        res.json({ message: 'Login successful!', user: publicUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'There was a problem during login, please try again' });
    }
});

// ============ CURRENT USER (device pe pehle se login check karne ke liye) ============
router.get('/me', requireAuth, (req, res) => {
    res.json({ loggedIn: true, user: publicUser(req.user) });
});

// ============ LOGOUT ============
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully.' });
});

// Google/Facebook login ab ek chota popup window mein khulta hai (poori tab
// cover nahi karta). Ye helper us popup ko turant band kar deta hai aur
// asal (opener) tab ko postMessage se result bata deta hai. Agar kabhi popup
// na ho (browser ne block kar diya tha, is liye normal full-page navigation
// hui), to seedha home page par redirect ho jata hai - jaisa pehle hota tha.
function sendOauthPopupResponse(res, success) {
    const type = success ? 'oauth-success' : 'oauth-failed';
    const fallbackUrl = success ? '/?auth=success' : '/?auth=failed';
    const heading = success ? 'Login successful!' : 'Login nahi ho saka';
    const message = success
        ? 'Aap login ho chuke hain. Ye tab ab band kar sakte hain.'
        : 'Kuch masla ho gaya, dobara try karein. Ye tab band kar dein.';

    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Melodiax</title>
<style>
    body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #121212;
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        text-align: center;
        padding: 24px;
    }
    .box { max-width: 320px; }
    h1 { font-size: 1.1rem; margin: 0 0 8px; color: ${success ? '#1db954' : '#ff4d4d'}; }
    p { font-size: 0.9rem; color: #b3b3b3; margin: 0; }
</style>
</head>
<body>
<div class="box">
    <h1>${heading}</h1>
    <p>${message}</p>
</div>
<script>
(function () {
    // Agar ye popup se khula tha (main tab ne open kiya tha) to usi tab ko
    // postMessage se turant bata dete hain - taake wahan login/signup turant
    // reflect ho jaye (jaise Spotify karta hai). Popup khud band NAHI hota,
    // user apni marzi se is tab ko close karega.
    if (window.opener) {
        window.opener.postMessage({ type: '${type}' }, window.location.origin);
    } else {
        // Popup blocked tha, is liye normal full-page navigation hui thi -
        // us case mein seedha home page par bhej dete hain.
        window.location.href = '${fallbackUrl}';
    }
})();
</script>
</body>
</html>`);
}

// ============ GOOGLE OAUTH ============
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
        if (err || !user) return sendOauthPopupResponse(res, false);
        const token = signToken(user._id);
        sendAuthCookie(res, token);
        return sendOauthPopupResponse(res, true);
    })(req, res, next);
});

// ============ FACEBOOK OAUTH ============
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));

router.get('/facebook/callback', (req, res, next) => {
    passport.authenticate('facebook', { session: false }, (err, user) => {
        if (err || !user) return sendOauthPopupResponse(res, false);
        const token = signToken(user._id);
        sendAuthCookie(res, token);
        return sendOauthPopupResponse(res, true);
    })(req, res, next);
});

module.exports = router;
