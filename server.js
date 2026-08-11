require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('./config/passport');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const songRoutes = require('./routes/songs');
const playlistRoutes = require('./routes/playlists');

const app = express();

connectDB();

app.set('trust proxy', 1); // Render/other proxy ke peeche express-rate-limit sahi kaam kare isliye

app.use(
    helmet({
        contentSecurityPolicy: false, // is project ke inline scripts/CDN fonts ki wajah se off rakha hai
        // Google/Facebook OAuth popup Google/Facebook ki site (cross-origin) se
        // hoke wapas aata hai - default COOP header is beech "window.opener"
        // hamesha ke liye tod deta hai, jis se popup apne parent tab ko
        // postMessage nahi bhej pata (aur galti se localhost home page load
        // kar leta hai). Isliye ye off rakha hai.
        crossOriginOpenerPolicy: false,
    })
);
// BASE_URL .env mein set na ho to bhi request ka origin allow karo (blank CORS
// origin ki wajah se hi zyada tar "backend se connect nahi horaha" issues aate hain)
app.use(cors({ origin: process.env.BASE_URL || true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// service-worker.js ko static serve karne ke bajaye yahan se, taake CACHE_NAME
// mein us waqt ki "shell" files (HTML/CSS/JS) ka hash daal saken - jab bhi in
// files mein se koi change ho, hash (isliye cache) khud badal jayega, aur
// purana cache activate event mein khud delete ho jayega. Isse manually kabhi
// version number badhana nahi padega, aur "changes nahi dikh rahe" wala issue
// khatam ho jayega.
const SHELL_FILES_FOR_HASH = [
    'Index.html', 'Style.css', 'Script.js',
    'playlist.js', 'playlist-banner.js', 'admin.js',
    'auth.js', 'confirm.js', 'offline.js', 'about.js',
    'mobile-menu.js', 'manifest.json',
];

function getShellHash() {
    const hash = crypto.createHash('md5');
    for (const file of SHELL_FILES_FOR_HASH) {
        try {
            hash.update(fs.readFileSync(path.join(__dirname, 'public', file)));
        } catch (e) {
            // file na mile to bhi hash calculate hote rehna chahiye
        }
    }
    return hash.digest('hex').slice(0, 10);
}

app.get('/service-worker.js', (req, res) => {
    let swCode = fs.readFileSync(path.join(__dirname, 'public', 'service-worker.js'), 'utf8');
    swCode = swCode.replace('__CACHE_VERSION__', getShellHash());
    res.set('Content-Type', 'text/javascript');
    // Browser is file ko khud kabhi bhi cache na kare - hamesha fresh copy
    // maange, taake naya CACHE_NAME turant mil sake.
    res.set('Cache-Control', 'no-cache');
    res.send(swCode);
});

// Frontend (Index.html, Style.css, Script.js, uploads/avatars) yahin se serve hoga
app.use(express.static(path.join(__dirname, 'public')));

// Sara account/auth ka kaam is prefix ke neeche
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/contact', require('./routes/contact'));

// Kisi bhi na-milne wali route pe frontend ka index.html hi bhej do (SPA-style fallback)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, 'public', 'Index.html'));
});

// Multer/validation jaisi errors ko bhi JSON format mein wapas bhejta hai
app.use((err, req, res, next) => {
    if (err) {
        console.error(err.message);
        return res.status(400).json({ message: err.message || 'Kuch ghalat ho gaya' });
    }
    next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running: http://localhost:${PORT}`);
});
