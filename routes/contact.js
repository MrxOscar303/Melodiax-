const express = require('express');
const rateLimit = require('express-rate-limit');

const { sendContactMessage } = require('../utils/mailer');

const router = express.Router();

// Spam se bachne ke liye - ek IP se limited attempts hi allow karte hain
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many messages sent, please try again after a while.' },
});

router.post('/', contactLimiter, async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ message: 'A valid email is required' });
        }
        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Message is required' });
        }

        await sendContactMessage({
            name: name.trim().slice(0, 200),
            email: email.trim().slice(0, 200),
            message: message.trim().slice(0, 5000),
        });

        res.json({ message: 'Message sent successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Could not send message, please try again' });
    }
});

module.exports = router;
