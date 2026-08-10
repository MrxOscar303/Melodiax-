const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

// ---------------- GOOGLE ----------------
// Google Cloud Console (console.cloud.google.com) -> APIs & Services -> Credentials
// -> Create Credentials -> OAuth client ID -> Web application
// Authorized redirect URI: <BASE_URL>/api/auth/google/callback
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: `${process.env.BASE_URL}/api/auth/google/callback`,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    let user = await User.findOne({ googleId: profile.id });
                    if (!user) {
                        // Agar isi email se pehle "local" signup ho chuka hai to usi account ko link kar dein
                        const email = profile.emails?.[0]?.value;
                        user = email ? await User.findOne({ email }) : null;

                        if (user) {
                            user.googleId = profile.id;
                            user.isVerified = true;
                            if (!user.profilePicture || user.profilePicture.includes('default-avatar')) {
                                user.profilePicture = profile.photos?.[0]?.value || user.profilePicture;
                            }
                            await user.save();
                        } else {
                            user = await User.create({
                                username: await makeUniqueUsername(profile.displayName || 'user'),
                                email: email || `${profile.id}@google.local`,
                                profilePicture: profile.photos?.[0]?.value || undefined,
                                authProvider: 'google',
                                googleId: profile.id,
                                isVerified: true,
                            });
                        }
                    }
                    return done(null, user);
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
}

// ---------------- FACEBOOK ----------------
// developers.facebook.com -> My Apps -> Create App -> Use case: Authenticate/Consumer
// -> Facebook Login -> Settings -> Valid OAuth Redirect URIs: <BASE_URL>/api/auth/facebook/callback
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
        new FacebookStrategy(
            {
                clientID: process.env.FACEBOOK_APP_ID,
                clientSecret: process.env.FACEBOOK_APP_SECRET,
                callbackURL: `${process.env.BASE_URL}/api/auth/facebook/callback`,
                profileFields: ['id', 'displayName', 'emails', 'photos'],
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    let user = await User.findOne({ facebookId: profile.id });
                    if (!user) {
                        const email = profile.emails?.[0]?.value;
                        user = email ? await User.findOne({ email }) : null;

                        if (user) {
                            user.facebookId = profile.id;
                            user.isVerified = true;
                            await user.save();
                        } else {
                            user = await User.create({
                                username: await makeUniqueUsername(profile.displayName || 'user'),
                                email: email || `${profile.id}@facebook.local`,
                                profilePicture: profile.photos?.[0]?.value || undefined,
                                authProvider: 'facebook',
                                facebookId: profile.id,
                                isVerified: true,
                            });
                        }
                    }
                    return done(null, user);
                } catch (err) {
                    return done(err, null);
                }
            }
        )
    );
}

// Google/Facebook se aaya naam pehle se kisi aur ne le rakha ho to uske aage number laga dete hain
async function makeUniqueUsername(base) {
    const clean = base.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    let candidate = clean;
    let count = 0;
    while (await User.findOne({ username: candidate })) {
        count += 1;
        candidate = `${clean}${count}`;
    }
    return candidate;
}

module.exports = passport;
