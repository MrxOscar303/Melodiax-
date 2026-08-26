// ============================================================
// PWA "Install App" support + native-app-style splash screen.
//
// 1) Splash screen: app-splash-screen (Index.html) ko thori der dikha kar
//    fade out kar dete hain - Android/iOS app jaisa launch feel.
//
// 2) Install App: "beforeinstallprompt" ko capture karke desktop nav ke
//    #nav-install-btn aur mobile hamburger ke #mobile-menu-install, dono
//    button dikhate hain (jab tak app already installed na ho). Click par
//    Chrome/Edge/Android jaisi jagah asal install-prompt khulta hai; jahan
//    ye event support nahi hota (iOS Safari, Firefox) wahan showConfirm()
//    se "Add to Home Screen" jaisi manual instructions dikha dete hain.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // ---------------- Splash screen ----------------
    const splash = document.getElementById('app-splash-screen');
    if (splash) {
        const MIN_SPLASH_TIME = 900; // ms - itni der to hamesha nazar aaye, chahe page kitni hi jaldi load ho jaye
        const hideSplash = () => {
            splash.classList.add('splash-hide');
            splash.addEventListener('transitionend', () => splash.remove(), { once: true });
            // Fallback agar transitionend na chale kisi wajah se
            setTimeout(() => splash.remove(), 900);
        };
        window.setTimeout(hideSplash, MIN_SPLASH_TIME);
    }

    // ---------------- Install App ----------------
    const navInstallBtn = document.getElementById('nav-install-btn');
    const menuInstallBtn = document.getElementById('mobile-menu-install');
    if (!navInstallBtn && !menuInstallBtn) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ desktop-jaisa UA bhejta hai
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true; // navigator.standalone = iOS Safari ka apna flag

    let deferredPrompt = null;

    function showInstallButtons() {
        if (navInstallBtn) navInstallBtn.style.display = '';
        if (menuInstallBtn) menuInstallBtn.style.display = '';
    }

    function hideInstallButtons() {
        if (navInstallBtn) navInstallBtn.style.display = 'none';
        if (menuInstallBtn) menuInstallBtn.style.display = 'none';
    }

    if (isStandalone) {
        // App pehle se hi installed/open hai (standalone window) - button dikhane
        // ka koi faida nahi.
        hideInstallButtons();
    } else if (isIOS) {
        // iOS Safari "beforeinstallprompt" kabhi fire nahi karta - button hamesha
        // dikhao, click par manual instructions.
        showInstallButtons();
    }
    // Baaki (Chrome/Edge/Android/desktop) browsers: button "beforeinstallprompt"
    // fire hone par hi dikhega (neeche).

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!isStandalone) showInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideInstallButtons();
    });

    async function handleInstallClick() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            return;
        }
        if (isIOS) {
            if (window.showConfirm) {
                await window.showConfirm(
                    'Tap the Share icon in Safari, then choose "Add to Home Screen" to install Melodiax.',
                    { confirmText: 'Got it', cancelText: 'Got it' }
                );
            } else {
                alert('Tap the Share icon in Safari, then choose "Add to Home Screen" to install Melodiax.');
            }
            return;
        }
        // Fallback for browsers with no beforeinstallprompt and no iOS-specific flow
        if (window.showConfirm) {
            await window.showConfirm(
                'To install Melodiax, open your browser menu and choose "Install App" or "Add to Home Screen".',
                { confirmText: 'Got it', cancelText: 'Got it' }
            );
        } else {
            alert('To install Melodiax, open your browser menu and choose "Install App" or "Add to Home Screen".');
        }
    }

    // Mobile hamburger ka #mobile-menu-install link mobile-menu.js me
    // wire('mobile-menu-install', 'nav-install-btn') se is asal button ka
    // click forward karta hai (menu band karke) - taake logic/behavior ek
    // hi jagah rahe, jaisa baaki sab mobile-menu links ke sath hai.
    if (navInstallBtn) navInstallBtn.addEventListener('click', handleInstallClick);
});
