// Default avatar pehle public/uploads/avatars/default-avatar.png par tha,
// lekin wo folder .gitignore mein hai - is liye GitHub/Render par kabhi
// gaya hi nahi, aur jin users ne apni koi photo upload nahi ki thi unka
// profilePicture isi (ab-broken) path par atka hua hai. Naya default asset
// ab public/assets/default-avatar.png par hai (tracked, hamesha deploy hota
// hai). Ye script un purane users ko naye path par update kar deta hai
// (jinhon ne khud koi custom photo upload ki hai unhe kabhi touch nahi karta).
//
// Chalayein (deploy/update ke baad sirf EK dafa):
//   node scripts/fixDefaultAvatarPath.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const OLD_PATH = '/uploads/avatars/default-avatar.png';
const NEW_PATH = '/assets/default-avatar.png';

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await User.updateMany(
        { profilePicture: OLD_PATH },
        { $set: { profilePicture: NEW_PATH } }
    );

    console.log(`✅ ${result.modifiedCount} user(s) ka default avatar path fix kar diya gaya.`);

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
