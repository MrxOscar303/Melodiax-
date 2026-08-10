// Ek chalne wali command se apne account ko admin bana lein:
//
//   node scripts/makeAdmin.js aapka@email.com
//
// (pehle Sign up/Log in kar ke wo email/username database mein bana lein,
// phir ye command chalayein - server ko restart karne ki zaroorat nahi)

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
    const identifier = process.argv[2];
    if (!identifier) {
        console.error('❌ Email ya username dein: node scripts/makeAdmin.js aapka@email.com');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const user = await User.findOneAndUpdate(
        { $or: [{ email: identifier.toLowerCase() }, { username: identifier }] },
        { isAdmin: true },
        { new: true }
    );

    if (!user) {
        console.error(`❌ "${identifier}" naam/email ka koi user nahi mila. Pehle signup karein.`);
    } else {
        console.log(`✅ ${user.username} (${user.email}) ab admin hai. Wapas login karein taake naya session mile.`);
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
