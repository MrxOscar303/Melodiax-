// "About us" tab - baaki tabs (Playlist/Downloads) jaisa hi show/hide pattern,
// plus contact form ko backend (/api/contact) par submit karna.
(function () {
    const aboutNavBtn = document.getElementById('nav-about-btn');
    const aboutSection = document.getElementById('about-view-section');
    const homeIconEl = document.querySelector('.home-icon');

    function fadeOutThen(elements, after) {
        const visible = elements.filter((el) => el && el.style.display !== 'none');
        if (!visible.length) { after(); return; }
        visible.forEach((el) => el.classList.add('view-hidden'));
        setTimeout(after, 220);
    }

    function fadeIn(elements) {
        elements.forEach((el) => { if (el) el.classList.add('view-hidden'); });
        if (elements[0]) void elements[0].offsetWidth; // reflow - taake transition chal sake
        requestAnimationFrame(() => {
            elements.forEach((el) => { if (el) el.classList.remove('view-hidden'); });
        });
    }

    function hideAboutTab() {
        if (!aboutSection || aboutSection.style.display === 'none') return;
        fadeOutThen([aboutSection], () => {
            aboutSection.style.display = 'none';
        });
    }

    // Turant (bina fade animation ke) chupa deta hai - jab koi doosra tab
    // (Playlist/Downloads) already apna fade-in animation kar raha ho, tab
    // About section ko alag se animate karna sirf overlap/flash create karta
    // hai. Isliye wahan ye instant version use hoti hai.
    function hideAboutTabInstant() {
        if (aboutSection) aboutSection.style.display = 'none';
    }

    function showAboutTab() {
        const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
        const playlistsSection = document.getElementById('playlists-view-section');
        const downloadsSection = document.getElementById('downloads-view-section');
        if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(false);
        // Premium tab agar khula ho to usko turant chupa do (naya tab khud
        // apna fade-in karega, isliye yahan animation ki zaroorat nahi).
        if (typeof window.melodiaxHidePremiumTabInstant === 'function') window.melodiaxHidePremiumTabInstant();

        fadeOutThen([...homeSections, playlistsSection, downloadsSection], () => {
            homeSections.forEach((sec) => { sec.style.display = 'none'; });
            if (playlistsSection) playlistsSection.style.display = 'none';
            if (downloadsSection) downloadsSection.style.display = 'none';
            if (aboutSection) {
                aboutSection.style.display = 'block';
                fadeIn([aboutSection]);
            }
        });
    }

    if (aboutNavBtn) aboutNavBtn.addEventListener('click', showAboutTab);
    if (homeIconEl) homeIconEl.addEventListener('click', hideAboutTab);

    // Playlist/Downloads tabs ko available karwana taake wo bhi About tab ko
    // hide kar saken jab unpar seedha (home icon use kiye baghair) switch kiya jaye.
    window.melodiaxHideAboutTab = hideAboutTab;
    window.melodiaxHideAboutTabInstant = hideAboutTabInstant;

    // ---------------- Contact form ----------------
    const form = document.getElementById('contact-form');
    const statusEl = document.getElementById('contact-form-status');
    const submitBtn = document.getElementById('contact-submit-btn');

    function showStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.style.display = 'block';
        statusEl.classList.toggle('contact-form-status-error', !!isError);
        statusEl.classList.toggle('contact-form-status-success', !isError);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-name').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            const message = document.getElementById('contact-message').value.trim();

            if (!name || !email || !message) {
                showStatus('Please fill in all fields.', true);
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, message }),
                });
                const data = await res.json();

                if (res.ok) {
                    showStatus("Thanks! Your message has been sent - we'll get back to you soon.", false);
                    form.reset();
                } else {
                    showStatus(data.message || 'Could not send message, please try again.', true);
                }
            } catch (err) {
                showStatus('Could not connect to the server, please try again.', true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
        });
    }
})();
