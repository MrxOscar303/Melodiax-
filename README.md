


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
ayega, jahan se copy karke browser mein khol sakte hain (local testing
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

1. https://developers.facebook.com/apps par jayein -> "Create App" ->


 karne par error -> `.env` mein Client
  ID/Secret ghalat hain ya redirect URI console mein match nahi kar raha.
