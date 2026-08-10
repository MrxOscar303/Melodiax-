// Email verification feature add hone se PEHLE jo log already signed up
// kar chuke the, unke pass isVerified field hi nahi hai (na true na false) -
// warna wo login karte waqt "please verify your email" mein phans jayenge
// bina kabhi verification email paaye. Ye script unn sab purane local
// accounts ko ek dafa verified mark kar deta hai (naye users par asar nahi
// padta - unke liye normal verification flow chalta rahega).
//
// Chalayein (deploy/update ke baad sirf EK dafa):
//   node scripts/verifyExistingUsers.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
    await mongoose.connect(process.env.MONGO_URI);

    const result = await User.updateMany(
        { authProvider: 'local', isVerified: { $ne: true } },
        { $set: { isVerified: true } }
    );

    console.log(`✅ ${result.modifiedCount} purane account(s) verified mark kar diye gaye.`);

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
