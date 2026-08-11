# Melodiax

Melodiax is a full-stack web music player featuring a library of over 1,000 songs. Built using Node.js and MongoDB Atlas with the help of AI tools, the entire project—including both the frontend and backend—was independently developed by Aiyz.

---

# Account System — Setup Guide (Roman Urdu)

Ye backend (Node.js + Express + MongoDB) aapki website mein add kar diya gaya
hai. Ab **Sign up** aur **Log in** buttons kaam karte hain, saara data
database mein save hota hai, aur agar koi user pehle se kisi device par
login/signup kar chuka ho to usay dobara login nahi karna parega.

## Ye kaam kaise karta hai (short mein)

1. User "Sign up" ya "Log in" button dabata hai -> ek modal khulta hai.
2. Signup form (username, email, password, profile picture optional)
   backend ko bhejta hai -> backend password ko **hash** karta hai
   (bcrypt) -> **MongoDB database** mein user save hota hai -> backend ek
   secure `httpOnly` cookie (JWT token) browser mein set kar deta hai.
3. Jab bhi wo user dobara website kholta hai, page load hote hi frontend
   `/api/auth/me` ko call karta hai. Agar cookie valid hai to backend "haan
   ye user X hai" bata deta hai aur **Sign up/Log in buttons apne aap
   gayab ho jate hain** — sirf profile picture + naam + Log out dikhta hai.
4. Ye cookie 30 din tak valid rehti hai, is liye same browser/device par
   dobara login nahi maanga jayega jab tak user khud "Log out" na kare ya
   cookie clear na ho.
5. Google/Facebook button dabane par user seedha Google/Facebook ke login
   page par jata hai, wahan se confirm karne ke baad wapas aapki site par
   already-logged-in aa jata hai (koi password yahan set nahi hota).

**Data kahan jayega?** Har user ka record (username, email, hashed
password, profile picture ka path, kis method se signup kiya) MongoDB
database mein jayega. Neeche "Data kaise dekhein" section mein bataya hai
ke ise kaise dekh sakte hain.

## File structure (naya kya add hua)

```
project/
├── server.js                 # Main backend server
├── package.json
├── .env.example               # Isko copy karke .env banayein
├── config/
│   ├── db.js                  # MongoDB connection
│   └── passport.js            # Google/Facebook login logic
├── models/
│   └── User.js                # Database mein user ka structure
├── routes/
│   └── auth.js                # /api/auth/signup, /login, /logout, /me, google, facebook
├── middleware/
│   └── authMiddleware.js      # Cookie check karke pehchanta hai user login hai ya nahi
└── public/                     # Aapki purani website yahan aa gayi hai
    ├── Index.html              # (login/signup modal add kiya gaya)
    ├── Style.css               # (auth modal ka design add kiya gaya)
    ├── Script.js                # (aapka original music player code - waisa hi hai)
    ├── auth.js                  # (NAYA - saara login/signup ka frontend logic)
    └── uploads/avatars/
        └── default-avatar.png   # Default profile picture
```

> Note: Aapke original project mein `Images/`, `Audio/`, `Videos/` folders
> the jo upload nahi hue the — wo folders `public/` ke andar copy kar dein
> taake gaane/pictures pehle ki tarah chalen.

## 1) Local (localhost) par testing

```bash
cd project
npm install
cp .env.example .env
```

`.env` file kholein aur kam az kam ye 2 cheezein set karein:

- `MONGO_URI` — agar aapke computer par MongoDB install hai to
  `mongodb://127.0.0.1:27017/spotify-clone` chalega. Agar install nahi
  hai to **MongoDB Atlas** (free) use karein — neeche steps hain.
- `JWT_SECRET` — koi bhi lamba random string likh dein (jaise
  `sd82hf9s8h2f...`), password ki tarah secret rakhein.

Google/Facebook `.env` variables abhi khali chhor sakte hain — jab tak
wo nahi bharte, sirf normal email/password signup-login kaam karega
(Google/Facebook buttons tab tak koi error nahi denge, bas connect nahi
honge).

### Email verification (naya)

Ab signup ke baad user ko login karne se pehle apna email verify karna
zaroori hai (confirmation link par click karke) — sirf real, access-able
email hi register ho sakti hai. Google/Facebook se signup/login karne
walon ke liye ye zaroorat nahi (unka email provider khud verify kar
chuka hota hai).

Verification email bhejne ke liye `.env` mein `EMAIL_HOST`, `EMAIL_USER`,
`EMAIL_PASS` set karein (Gmail App Password recommended - upar
`.env.example` mein steps hain). **Agar ye set nahi karte to app crash
nahi hoga** - verification link sirf terminal/console mein print ho
jayega, jahan se copy karke browser mein khol sakte hain (local testing
ke liye kaafi hai, production ke liye real SMTP zaroori hai).

**Zaroori (agar aapke pass pehle se signed-up users hain):** ye update
lagane ke baad ek dafa ye command chalayein, warna purane users
(jo email-verification feature se pehle bane the) login nahi kar
payenge:

```bash
node scripts/verifyExistingUsers.js
```

Server chalayein:

```bash
npm start
```

Browser mein kholein: **http://localhost:5000**

(Port `.env` mein `PORT` se change kar sakte hain.)

### MongoDB Atlas (free, recommended — localhost aur online hosting dono
ke liye kaam karta hai, kuch install karne ki zaroorat nahi)

1. https://www.mongodb.com/cloud/atlas/register par free account banayein.
2. "Create a free cluster" (M0 Free tier) select karein.
3. **Database Access** mein ek user banayein (username/password) — ye wahi
   hai jo connection string mein jayega.
4. **Network Access** mein "Allow access from anywhere" (0.0.0.0/0) add
   karein (testing ke liye simplest).
5. "Connect" -> "Drivers" par click karke connection string copy karein,
   jaisa: `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/`
6. Isay `.env` ke `MONGO_URI` mein daal dein, aakhir mein
   `/spotify-clone` add kar dein (database ka naam):
   `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/spotify-clone`

## 2) Data kaise dekhein (har user ka data)

- **MongoDB Atlas dashboard** kholein -> apna cluster -> "Browse
  Collections" -> `spotify-clone` database -> `users` collection. Yahan
  har signup hone wale user ka record dikhega (password hashed/encrypted
  form mein hoga, plain text mein kabhi nahi dikhega — ye security ke
  liye zaroori hai).
- Ya phir `mongosh` (MongoDB shell) se local database check kar sakte
  hain: `mongosh` -> `use spotify-clone` -> `db.users.find().pretty()`

## 3) Google Login setup

1. https://console.cloud.google.com par jayein -> naya project banayein.
2. "APIs & Services" -> "OAuth consent screen" -> basic info fill karein
   (App name, support email) -> save.
3. "Credentials" -> "Create Credentials" -> "OAuth client ID" -> Application
   type: **Web application**.
4. **Authorized redirect URIs** mein ye add karein:
   - Local: `http://localhost:5000/api/auth/google/callback`
   - Live site: `https://aapka-domain.com/api/auth/google/callback`
5. Jo `Client ID` aur `Client Secret` milega, wo `.env` mein
   `GOOGLE_CLIENT_ID` aur `GOOGLE_CLIENT_SECRET` mein daal dein.
6. Server restart karein — "Continue with Google" button ab kaam karega.

## 4) Facebook Login setup

1. https://developers.facebook.com/apps par jayein -> "Create App" ->
   use case "Authenticate and request data from users with Facebook
   Login" select karein.
2. App dashboard mein "Facebook Login" -> "Settings" mein **Valid OAuth
   Redirect URIs** add karein:
   - Local: `http://localhost:5000/api/auth/facebook/callback`
   - Live site: `https://aapka-domain.com/api/auth/facebook/callback`
3. App Settings -> Basic se `App ID` aur `App Secret` copy karein, `.env`
   ke `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` mein daal dein.
4. Jab tak app "Live" mode mein nahi jati, sirf aap (developer/admin/
   tester role wale) hi Facebook login test kar sakte hain — public
   users ke liye Meta se app review chahiye hoga.

## 5) Online hosting par upload karna

Ye backend kisi bhi **Node.js hosting** par chal jayega — jaise
**Render.com** (free tier available, sabse aasan) ya Railway/Fly.io/
apna VPS.

Render.com par steps (example):

1. Is poore project ko GitHub repo mein push karein (`.env` push NA
   karein — `.gitignore` mein already exclude hai).
2. Render.com par "New Web Service" -> apna GitHub repo select karein.
3. Build command: `npm install` — Start command: `npm start`
4. "Environment" tab mein wahi variables daalein jo `.env` mein the
   (`MONGO_URI`, `JWT_SECRET`, `BASE_URL` = aapka live URL jaise
   `https://mysite.onrender.com`, waghera).
5. Deploy hone ke baad Google/Facebook console mein jo redirect URIs
   diye the, unme apna live URL (http nahi, **https**) bhi add kar dein.
6. `NODE_ENV=production` set karein taake cookies sirf HTTPS par secure
   tareeke se kaam karein.

## Security ka khayal rakha gaya hai

- Password kabhi plain text mein save nahi hota — `bcrypt` se hash hota
  hai (12 rounds).
- Login session ek `httpOnly` cookie mein rehta hai, JavaScript se isay
  directly padha/churaya nahi ja sakta (XSS se protection).
- Production mein (`NODE_ENV=production`) cookie sirf HTTPS par jati hai.
- Signup/Login par rate-limiting hai (15 minute mein 20 attempts) taake
  koi automated tool password guess na kar sake.
- Profile picture upload sirf images (jpg/png/webp/gif) accept karta hai
  aur size 3MB tak limit hai.

## Agar kuch kaam na kare

- Browser console (F12) aur terminal (jahan `npm start` chalaya) dono
  check karein — error wahin dikhega.
- "MongoDB connection failed" -> `.env` ka `MONGO_URI` galat hai ya
  Atlas mein Network Access allow nahi kiya.
- Google/Facebook button click karne par error -> `.env` mein Client
  ID/Secret ghalat hain ya redirect URI console mein match nahi kar raha.
