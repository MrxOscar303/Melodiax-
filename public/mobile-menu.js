// ============================================================
// Mobile hamburger side-menu (sirf <=768px pe hamburger icon se nazar aata
// hai). Ye khud koi naya feature/logic nahi banata - sirf panel
// open/close karta hai aur uske andar ke links/buttons ko unke
// asal nav counterparts (home-icon, nav-playlist-btn, wagera) pe click
// forward karta hai, taake behavior har jagah bilkul same rahe.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const overlay = document.getElementById('mobile-menu-overlay');
    const panel = document.getElementById('mobile-menu-panel');
    const closeBtn = document.getElementById('mobile-menu-close');

    if (!menuBtn || !overlay || !panel) return;

    // Navbar ki asal (real, rendered) height nikal ke ek CSS variable me daal
    // dete hain - taake hamburger panel / Your Playlists / Create Playlist,
    // sab navbar ke bilkul flush neeche se hi shuru hon (koi guess-based
    // rem value nahi, chahe font/icon size kisi bhi device par thora upar-
    // neeche kyun na ho).
    function syncNavbarHeight() {
        const navEl = document.querySelector('nav');
        if (!navEl) return;
        const h = navEl.getBoundingClientRect().height;
        if (h > 0) {
            document.documentElement.style.setProperty('--mobile-navbar-h', h + 'px');
        }
    }
    syncNavbarHeight();
    window.addEventListener('resize', syncNavbarHeight);
    window.addEventListener('orientationchange', syncNavbarHeight);

    function syncDownloadsLink() {
        const realDownloadsBtn = document.getElementById('nav-downloads-btn');
        const menuDownloadsLink = document.getElementById('mobile-menu-downloads');
        if (!realDownloadsBtn || !menuDownloadsLink) return;
        const realHidden = window.getComputedStyle(realDownloadsBtn).display === 'none';
        menuDownloadsLink.style.display = realHidden ? 'none' : '';
    }

    function openMenu() {
        syncDownloadsLink();
        overlay.classList.add('open');
        // Ek frame chhod dete hain taake "display" pehle apply ho jaye,
        // phir transform transition smoothly chal sake.
        requestAnimationFrame(() => {
            panel.classList.add('open');
        });
        panel.setAttribute('aria-hidden', 'false');
        menuBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('mobile-menu-open');
    }

    function closeMenu() {
        panel.classList.remove('open');
        overlay.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('mobile-menu-open');
    }

    menuBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    document.getElementById('mobile-menu-exit')?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) closeMenu();
    });

    // Menu ke andar ka koi bhi link/button click hone par asal (hidden)
    // button ko click karo phir menu band kar do - taake dono jagah ka
    // logic ek hi rahe, duplicate na ho.
    function wire(menuId, realId) {
        const menuEl = document.getElementById(menuId);
        if (!menuEl) return;
        menuEl.addEventListener('click', (e) => {
            e.preventDefault();
            const realEl = document.getElementById(realId);
            closeMenu();
            if (realEl) realEl.click();
        });
    }

    document.getElementById('mobile-menu-home')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        const homeIcon = document.querySelector('.home-icon');
        if (homeIcon) homeIcon.click();
    });
    // Premium ka abhi apna koi page/handler nahi hai (desktop nav text me
    // bhi wahi haal hai) - menu sirf band ho jaye.
    document.getElementById('mobile-menu-premium')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
    });
    wire('mobile-menu-about', 'nav-about-btn');
    wire('mobile-menu-downloads', 'nav-downloads-btn');
    wire('mobile-menu-playlist', 'nav-playlist-btn');
    wire('mobile-menu-create-playlist', 'create-playlist-btn');
    wire('mobile-menu-browse-podcasts', 'browse-podcasts-btn');

    // "Leave" buttons - Your Playlists / Downloads ke mobile full-screen
    // view se wapas Home par le jaate hain (home-icon jaisa hi behavior).
    function wireLeave(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const homeIcon = document.querySelector('.home-icon');
            if (homeIcon) homeIcon.click();
        });
    }
    wireLeave('playlists-view-leave-btn');
    wireLeave('downloads-view-leave-btn');
    wireLeave('about-view-leave-btn');

    // Downloads nav-button ki visibility offline.js dynamically badalta
    // rehta hai (jab pehla gaana download/delete ho) - menu khulne par
    // hum already sync karte hain, lekin agar menu khula hi rahe tab bhi
    // update ho jaye is liye halka observer.
    const realDownloadsBtn = document.getElementById('nav-downloads-btn');
    if (realDownloadsBtn && window.MutationObserver) {
        const obs = new MutationObserver(syncDownloadsLink);
        obs.observe(realDownloadsBtn, { attributes: true, attributeFilter: ['style'] });
    }

    // Mobile par search-bar chhota hai (icon/folder hata diye) is liye
    // placeholder bhi chhota "Search.." rakhte hain - desktop par asal
    // lamba placeholder ("What do you want to play?") wapas aa jata hai.
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        const desktopPlaceholder = searchInput.getAttribute('placeholder') || 'What do you want to play?';
        const mobileQuery = window.matchMedia('(max-width: 768px)');
        function syncSearchPlaceholder() {
            searchInput.placeholder = mobileQuery.matches ? 'Search..' : desktopPlaceholder;
        }
        syncSearchPlaceholder();
        mobileQuery.addEventListener ? mobileQuery.addEventListener('change', syncSearchPlaceholder)
                                      : mobileQuery.addListener(syncSearchPlaceholder); // older Safari fallback
    }

    // Mobile par player-bar ka projector button (jo desktop pe screen ke
    // top-right corner me floating rehta hai) ab neeche wali volume-row me,
    // wahi jagah jahan pehle download button hota tha, le jate hain - chhota
    // aur kam-animated (CSS me handle hota hai). Download button apni asal
    // now-bar (song name ke baad) jagah par hi rehta hai - wahi "marked"
    // top-right spot. ID/state (Script.js) getElementById se hi kaam karta
    // hai, is liye node ko yahan se wahan move karne se kuch nahi tootega.
    const projectorBtn = document.getElementById('exit-projector-btn');
    const volumeContainer = document.querySelector('.volume-container');
    const themeToggle = document.getElementById('theme-toggle');
    if (projectorBtn && volumeContainer) {
        const projectorMobileQuery = window.matchMedia('(max-width: 768px)');
        const projectorOriginalParent = projectorBtn.parentElement;
        const projectorOriginalNextSibling = projectorBtn.nextSibling;
        function placeProjectorBtn(isMobile) {
            if (isMobile) {
                if (projectorBtn.parentElement !== volumeContainer) {
                    volumeContainer.insertBefore(projectorBtn, themeToggle || volumeContainer.firstChild);
                }
            } else if (projectorBtn.parentElement !== projectorOriginalParent) {
                projectorOriginalParent.insertBefore(projectorBtn, projectorOriginalNextSibling);
            }
        }
        placeProjectorBtn(projectorMobileQuery.matches);
        projectorMobileQuery.addEventListener ? projectorMobileQuery.addEventListener('change', (e) => placeProjectorBtn(e.matches))
                                               : projectorMobileQuery.addListener((e) => placeProjectorBtn(e.matches)); // older Safari fallback
    }
});
