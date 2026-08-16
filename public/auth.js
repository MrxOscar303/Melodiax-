// ============================================================
// Account system frontend logic (Signup / Login / Logout /
// Google & Facebook OAuth / "already logged in on this device")
// ============================================================

const API = '/api/auth';

const authModal = document.getElementById('auth-modal');
const authCloseBtn = document.getElementById('auth-close-btn');
const authModalTitle = document.getElementById('auth-modal-title');

const openSignupBtn = document.getElementById('open-signup-btn');
const openLoginBtn = document.getElementById('open-login-btn');

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');
const resendHint = document.getElementById('resend-verification-hint');
const resendLink = document.getElementById('resend-verification-link');
let pendingVerificationEmail = null;

const guestButtons = document.getElementById('guest-auth-buttons');
const userProfileBox = document.getElementById('user-profile-box');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');

const avatarInput = document.getElementById('signup-avatar');
const avatarPreview = document.getElementById('avatar-preview');

// ---------------- Modal open/close ----------------
function openModal(tab = 'login') {
    authError.classList.remove('visible');
    authError.textContent = '';
    authSuccess.classList.remove('visible');
    authSuccess.textContent = '';
    resendHint.style.display = 'none';
    switchTab(tab);
    authModal.style.display = 'block';
}

function closeModal() {
    authModal.style.display = 'none';
}

function switchTab(tab) {
    const isLogin = tab === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabSignup.classList.toggle('active', !isLogin);
    loginForm.style.display = isLogin ? 'flex' : 'none';
    signupForm.style.display = isLogin ? 'none' : 'flex';
    authModalTitle.textContent = isLogin ? 'Log in' : 'Sign up';
    authError.classList.remove('visible');
    authSuccess.classList.remove('visible');
    resendHint.style.display = 'none';
}

if (openSignupBtn) openSignupBtn.addEventListener('click', () => openModal('signup'));
if (openLoginBtn) openLoginBtn.addEventListener('click', () => openModal('login'));
if (authCloseBtn) authCloseBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal();
});
if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
if (tabSignup) tabSignup.addEventListener('click', () => switchTab('signup'));

const switchToSignup = document.getElementById('switch-to-signup');
const switchToLogin = document.getElementById('switch-to-login');
if (switchToSignup) switchToSignup.addEventListener('click', () => switchTab('signup'));
if (switchToLogin) switchToLogin.addEventListener('click', () => switchTab('login'));

// ---------------- Profile picture preview ----------------
if (avatarInput) {
    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (file) avatarPreview.src = URL.createObjectURL(file);
    });
}

// ---------------- UI helpers ----------------
function showError(msg) {
    authSuccess.classList.remove('visible');
    authError.textContent = msg;
    authError.classList.add('visible');
}
function showSuccess(msg) {
    authError.classList.remove('visible');
    authSuccess.textContent = msg;
    authSuccess.classList.add('visible');
}
function showResendHint(email) {
    pendingVerificationEmail = email;
    resendHint.style.display = 'block';
}

if (resendLink) {
    resendLink.addEventListener('click', async () => {
        if (!pendingVerificationEmail) return;
        resendLink.textContent = 'Sending...';
        try {
            const res = await fetch(`${API}/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: pendingVerificationEmail }),
            });
            const data = await res.json();
            showSuccess(data.message || 'Verification email has been sent.');
            resendHint.style.display = 'none';
        } catch (err) {
            showError('Could not connect to the server.');
        } finally {
            resendLink.textContent = 'Resend verification email';
        }
    });
}

const adminPanelBtn = document.getElementById('admin-panel-btn');

function showLoggedInUI(user) {
    window.currentUser = user; // admin.js isko use karta hai (isAdmin check ke liye)
    // Last logged-in user ki id localStorage me bhi rakh do (network se
    // independent) - taake offline hone par (jab /api/auth/me fetch fail ho
    // jaye) offline.js phir bhi sahi user ki downloads database dhoond sake.
    try { localStorage.setItem('melodiax-last-uid', user.id); } catch (err) { /* storage blocked - ignore */ }
    guestButtons.style.display = 'none';
    userProfileBox.style.display = 'flex';
    userAvatar.src = user.profilePicture;
    userName.textContent = user.username;
    if (adminPanelBtn) adminPanelBtn.style.display = user.isAdmin ? 'flex' : 'none';
    window.dispatchEvent(new Event('melodiax-auth-changed')); // playlist.js is user ki apni playlists load karta hai
}

function showGuestUI() {
    window.currentUser = null;
    guestButtons.style.display = 'flex';
    userProfileBox.style.display = 'none';
    if (adminPanelBtn) adminPanelBtn.style.display = 'none';
    window.dispatchEvent(new Event('melodiax-auth-changed')); // playlist.js guest ki playlists par switch karta hai
}

// ---------------- Check session on page load ----------------
// Ye function check karta hai ke is device/browser par pehle se login/signup
// hua hua hai ya nahi. Agar valid session mili to Sign up/Log in buttons
// gayab ho jate hain aur seedha logged-in view dikhta hai.
async function checkSession() {
    try {
        const res = await fetch(`${API}/me`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            showLoggedInUI(data.user);
        } else {
            // Server ne saaf mana kiya (401 waghera) - ye genuine logged-out
            // hai, is liye cached uid bhi saaf kar dete hain.
            try { localStorage.removeItem('melodiax-last-uid'); } catch (err) { /* ignore */ }
            showGuestUI();
        }
    } catch (err) {
        // Fetch khud fail hui (network/offline) - ye logout nahi, sirf internet
        // na hone ki wajah se hai. Account UI guest jaisa dikhado (jaisa user
        // chahte hain), lekin 'melodiax-last-uid' ko chhedo mat - offline.js
        // isi se pehle se downloaded gaanon ki sahi database dhoondta hai.
        showGuestUI();
    }
}
checkSession();

// ---------------- Google / Facebook login - chota popup window ----------------
// Poori tab cover karne ke bajaye, ek chota popup window khulta hai jahan
// user Google/Facebook se login karta hai. Kaam poora hote hi (routes/auth.js
// ka callback) popup khud band ho jata hai aur is (main) tab ko postMessage
// se bata deta hai - taake session turant refresh ho jaye.
const googleOauthBtn = document.getElementById('google-oauth-btn');
const facebookOauthBtn = document.getElementById('facebook-oauth-btn');

function openOAuthPopup(provider) {
    const width = 480;
    const height = 640;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
        `/api/auth/${provider}`,
        'oauthPopup',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );
    if (!popup) {
        // Popup blocked ho gaya (browser setting) - purana full-page tareeqa hi chalayein
        window.location.href = `/api/auth/${provider}`;
    }
}

if (googleOauthBtn) {
    googleOauthBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openOAuthPopup('google');
    });
}
if (facebookOauthBtn) {
    facebookOauthBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openOAuthPopup('facebook');
    });
}

// Popup window (routes/auth.js callback) yahan postMessage bhejta hai jab
// Google/Facebook login mukammal ho jaye.
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'oauth-success') {
        closeModal();
        checkSession();
    } else if (event.data.type === 'oauth-failed') {
        showError('Could not log in with Google/Facebook. Please try again.');
    }
});

// Google/Facebook redirect ke baad wapas aane par URL clean kar dein
// (sirf popup blocked hone ke fallback case mein hi ye URL par aata hai)
if (window.location.search.includes('auth=')) {
    const url = new URL(window.location);
    const authResult = url.searchParams.get('auth');
    url.searchParams.delete('auth');
    window.history.replaceState({}, '', url);
    if (authResult === 'failed') {
        openModal('login');
        showError('Could not log in with Google/Facebook. Please try again.');
    }
}

// Email verification link (routes/auth.js ka /verify-email) click karne ke
// baad yahan wapas redirect hota hai - ?verify=success/invalid/missing/error
if (window.location.search.includes('verify=')) {
    const url = new URL(window.location);
    const verify = url.searchParams.get('verify');
    const verifyEmail = url.searchParams.get('email');
    url.searchParams.delete('verify');
    url.searchParams.delete('email');
    window.history.replaceState({}, '', url);

    openModal('login');
    if (verify === 'success') {
        showSuccess('Email verified! You can now log in.');
    } else if (verify === 'invalid') {
        showError('This verification link is invalid or has expired. Request a new link below.');
        if (verifyEmail) showResendHint(verifyEmail);
    } else {
        showError('Could not verify the email. Please try again or request a new verification link.');
    }
}

// ---------------- Login submit ----------------
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = loginForm.querySelector('.auth-submit-btn');
    submitBtn.disabled = true;
    authError.classList.remove('visible');

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                emailOrUsername: document.getElementById('login-identifier').value.trim(),
                password: document.getElementById('login-password').value,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            showError(data.message || 'Could not log in');
            if (data.requiresVerification && data.email) {
                showResendHint(data.email);
            }
            return;
        }
        showLoggedInUI(data.user);
        closeModal();
        loginForm.reset();
    } catch (err) {
        showError('Could not connect to the server. Is the backend running?');
    } finally {
        submitBtn.disabled = false;
    }
});

// ---------------- Signup submit ----------------
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = signupForm.querySelector('.auth-submit-btn');
    submitBtn.disabled = true;
    authError.classList.remove('visible');

    try {
        const formData = new FormData();
        formData.append('username', document.getElementById('signup-username').value.trim());
        formData.append('email', document.getElementById('signup-email').value.trim());
        formData.append('password', document.getElementById('signup-password').value);
        if (avatarInput.files[0]) {
            formData.append('profilePicture', avatarInput.files[0]);
        }

        const res = await fetch(`${API}/signup`, {
            method: 'POST',
            credentials: 'include',
            body: formData, // Content-Type header khud set na karein, browser boundary ke sath karega
        });
        const data = await res.json();
        if (!res.ok) {
            showError(data.message || 'Could not sign up');
            return;
        }

        if (data.requiresVerification) {
            // Account ban gaya lekin abhi login nahi hua - email verify hone
            // tak wait karna hoga. Signup form ko login tab par bhej dete hain
            // taake verify karne ke baad wahin se login kar sakein.
            const emailForResend = data.email;
            signupForm.reset();
            avatarPreview.src = '/assets/default-avatar.png';
            switchTab('login');
            showSuccess(data.message || 'Account created! Check your inbox to verify your email.');
            showResendHint(emailForResend);
            return;
        }

        // (Fallback - agar kabhi backend seedha login kar de to bhi UI sahi chale)
        showLoggedInUI(data.user);
        closeModal();
        signupForm.reset();
        avatarPreview.src = '/assets/default-avatar.png';
    } catch (err) {
        showError('Could not connect to the server. Is the backend running?');
    } finally {
        submitBtn.disabled = false;
    }
});

// ---------------- Logout ----------------
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
        // ignore network error, UI ko phir bhi guest bana dete hain
    }
    try { localStorage.removeItem('melodiax-last-uid'); } catch (err) { /* ignore */ }
    showGuestUI();
});
