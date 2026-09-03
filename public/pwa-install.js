// ============================================================
// PWA "Install App" support + native-app-style splash screen.
//
// 1) Splash screen: app-splash-screen (Index.html) ko thori der dikha kar
//    fade out kar dete hain - Android/iOS app jaisa launch feel.
//
// 2) Install App:
//    - DESKTOP (Windows/Mac/Linux browser): button hamesha dikhta hai, aur
//      click karte hi asal Melodiax.exe installer seedha download ho jata
//      hai (browser ka halka PWA install nahi - ye real, proper Windows
//      installer hai jo public/downloads/Melodiax-Setup.exe se serve hota
//      hai). User use chala kar khud install kar leta hai.
//    - MOBILE (Android/iOS): purana wahi PWA/"Add to Home Screen" flow -
//      "beforeinstallprompt" (Android Chrome/Edge) se asal install-prompt,
//      ya iOS ke liye manual "Share > Add to Home Screen" instructions.
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

    // Agar hum already Electron desktop app ke andar chal rahe hain, to
    // "Install App" dikhana hi illogical hai (app pehle se installed hai
    // aur chal rahi hai) - is liye button hamesha hidden rakhte hain.
    if (window.melodiaxDesktop && window.melodiaxDesktop.isElectron) {
        if (navInstallBtn) navInstallBtn.style.display = 'none';
        if (menuInstallBtn) menuInstallBtn.style.display = 'none';
        return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ desktop-jaisa UA bhejta hai
    const isOtherMobile = /android|iemobile|blackberry|opera mini/i.test(navigator.userAgent);
    const isDesktop = !isIOS && !isOtherMobile; // Windows/Mac/Linux par browser - yahan .exe installer download hoga
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
    } else if (isIOS || isDesktop) {
        // iOS: "beforeinstallprompt" kabhi fire nahi karta.
        // Desktop: .exe download hamesha available hai, kisi event ka wait
        // nahi karna - is liye dono jagah button seedha shuru se dikhao.
        showInstallButtons();
        if (isDesktop && navInstallBtn) navInstallBtn.title = 'Download Melodiax for Windows';
    }
    // Android/doosre mobile browsers: button "beforeinstallprompt" fire hone
    // par hi dikhega (neeche) - is se pehle chupa rehta hai.

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!isStandalone && !isDesktop) showInstallButtons(); // desktop ke liye humara apna .exe flow hai, browser wala prompt use nahi karna
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideInstallButtons();
    });

    function downloadDesktopInstaller() {
        const a = document.createElement('a');
        a.href = '/downloads/Melodiax-Setup.exe';
        a.download = 'Melodiax-Setup.exe';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async function handleInstallClick() {
        if (isDesktop) {
            downloadDesktopInstaller();
            return;
        }
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            return;
        }
        if (isIOS) {
            // iOS ke sab browsers (Safari, Chrome, Edge, Firefox) WebKit ka
            // wahi system Share sheet use karte hain, is liye instruction
            // kisi ek browser ka naam liye baghair generic rakha hai - taake
            // kisi bhi iOS browser me sahi lage.
            const iosMsg = 'Tap the Share icon in your browser\'s toolbar, then choose "Add to Home Screen" to install Melodiax.';
            if (window.showConfirm) {
                await window.showConfirm(iosMsg, { confirmText: 'Got it', cancelText: 'Got it' });
            } else {
                alert(iosMsg);
            }
            return;
        }
        // Fallback for other mobile browsers with no beforeinstallprompt
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
