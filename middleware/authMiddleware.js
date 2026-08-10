const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Ye function cookie ("token") ke andar se JWT nikal kar check karta hai
// ke user pehle se logged in hai ya nahi. Isi se "device par pehle login
// hua tha to dobara login na maango" wala kaam hota hai.
async function requireAuth(req, res, next) {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ loggedIn: false, message: 'Not logged in' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ loggedIn: false, message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ loggedIn: false, message: 'Invalid or expired session' });
    }
}

// Optional version: agar token valid hai to req.user set kar dega, warna
// bina error diye aage badh jayega (home page load karte waqt use hota hai).
async function attachUserIfLoggedIn(req, res, next) {
    try {
        const token = req.cookies.token;
        if (!token) return next();
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) req.user = user;
    } catch (err) {
        // token invalid/expired - chup chaap ignore, guest ki tarah treat hoga
    }
    next();
}

// requireAuth ke BAAD lagayein - agar user logged in hai lekin admin nahi to 403 bhej dega.
// Route pe: router.post('/songs', requireAuth, requireAdmin, ...)
function requireAdmin(req, res, next) {
    if (!req.user || req.user.isAdmin !== true) {
        return res.status(403).json({ message: 'Sirf admin isko access kar sakte hain' });
    }
    next();
}

module.exports = { requireAuth, attachUserIfLoggedIn, requireAdmin };
