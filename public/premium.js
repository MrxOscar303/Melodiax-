// ==========================================================================
// PREMIUM TAB (Melodiax)
// - "Premium" nav button click karne par baaki tabs (Playlist/Downloads/
//   About us) jaisa hi smooth fade-transition ke saath ye section khulta
//   hai - bare/bade cards, har card ek plan (Silver/Gold/Diamond/Platinum
//   default hote hain, admin unhe edit/add/remove kar sakta hai).
// - Data /api/premium se aata hai. Admin ko top-right ek chhota pencil
//   button dikhta hai (bilkul playlist-banner-edit-btn jaisa) jisse
//   add/edit/delete panel khulta hai.
// - Sabse neeche hamesha ek chhota note: "This feature is under maintenance"
//   (abhi actual purchase/payment flow nahi bana hai).
//
// Note: Script.js/admin.js/playlist-banner.js is script se pehle load hote
// hain (classic, non-module <script> tags), is liye unke global helpers
// (escapeHtml, isAdminUser, showConfirm) yahan bhi seedha use ho sakte hain.
// ==========================================================================
(function () {
    'use strict';

    const PREMIUM_API = '/api/premium';

    let premiumPlans = [];

    // ---------------- Public tab elements ----------------
    const navPremiumBtn = document.getElementById('nav-premium-btn');
    const premiumSection = document.getElementById('premium-view-section');
    const premiumCardsGrid = document.getElementById('premium-cards-grid');
    const premiumEditBtn = document.getElementById('premium-edit-btn');
    const homeIconEl = document.querySelector('.home-icon');

    // ---------------- Admin panel elements ----------------
    const premiumPanel = document.getElementById('premium-panel');
    const premiumPanelOverlay = document.getElementById('premium-panel-overlay');
    const premiumPanelClose = document.getElementById('premium-panel-close');
    const premiumForm = document.getElementById('premium-form');
    const premiumEditId = document.getElementById('premium-edit-id');
    const premiumNameInput = document.getElementById('premium-name');
    const premiumPriceInput = document.getElementById('premium-price');
    const premiumTaglineInput = document.getElementById('premium-tagline');
    const premiumBadgeInput = document.getElementById('premium-badge');
    const premiumImageInput = document.getElementById('premium-image');
    const premiumImagePreview = document.getElementById('premium-image-preview');
    const premiumFeaturesInput = document.getElementById('premium-features');
    const premiumColorInput = document.getElementById('premium-color');
    const premiumColorCustom = document.getElementById('premium-color-custom');
    const premiumSwatchesWrap = document.getElementById('premium-swatches');
    const premiumOrderInput = document.getElementById('premium-order');
    const premiumFormError = document.getElementById('premium-form-error');
    const premiumFormSuccess = document.getElementById('premium-form-success');
    const premiumSubmitBtn = document.getElementById('premium-submit-btn');
    const premiumCancelEditBtn = document.getElementById('premium-cancel-edit');
    const premiumList = document.getElementById('premium-list');
    const premiumPanelTitle = document.getElementById('premium-panel-title');

    // ============================================================
    // ---------------- Public: fetch + render cards ----------------
    // ============================================================
    async function loadPremiumPlans() {
        try {
            const res = await fetch(PREMIUM_API);
            const data = await res.json();
            premiumPlans = data.plans || [];
        } catch (err) {
            console.warn('Premium plans failed to load:', err);
            premiumPlans = [];
        }
        renderPremiumCards();
    }

    function renderPremiumCards() {
        if (!premiumCardsGrid) return;
        const admin = typeof isAdminUser === 'function' && isAdminUser();

        if (!premiumPlans.length) {
            premiumCardsGrid.innerHTML = admin
                ? `<div class="premium-empty-state">
                        <p>No premium plans yet.</p>
                        <p>Top-right pencil button se pehla plan add karein.</p>
                   </div>`
                : `<div class="premium-empty-state"><p>Premium plans are coming soon.</p></div>`;
            return;
        }

        premiumCardsGrid.innerHTML = premiumPlans.map((p) => buildPremiumCardHtml(p)).join('');
    }

    function buildPremiumCardHtml(p) {
        const color = escapeHtml(p.color || '#1db954');
        const featuresHtml = (p.features || [])
            .map((f) => `<li><i class="fa-solid fa-check"></i> ${escapeHtml(f)}</li>`)
            .join('');
        // Admin ne cover image di ho to crown icon ki jagah wahi dikhti hai
        // (same chhota circle, card ka size nahi badalta) - warna purana
        // crown icon fallback ke tor par rehta hai.
        const iconHtml = p.image
            ? `<div class="premium-card-icon premium-card-icon-image"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)} cover"></div>`
            : `<div class="premium-card-icon"><i class="fa-solid fa-crown"></i></div>`;
        return `
            <div class="premium-card" style="--premium-card-color: ${color};">
                ${p.badge ? `<span class="premium-card-badge">${escapeHtml(p.badge)}</span>` : ''}
                ${iconHtml}
                <h3 class="premium-card-name">${escapeHtml(p.name)}</h3>
                ${p.price ? `<div class="premium-card-price">${escapeHtml(p.price)}</div>` : ''}
                ${p.tagline ? `<p class="premium-card-tagline">${escapeHtml(p.tagline)}</p>` : ''}
                ${featuresHtml ? `<ul class="premium-card-features">${featuresHtml}</ul>` : ''}
                <button type="button" class="premium-card-cta">Choose ${escapeHtml(p.name)}</button>
            </div>`;
    }

    // ============================================================
    // ---------------- Public: tab show/hide (smooth transition) ----------------
    // Playlist/Downloads/About us jaisa hi shared ".view-hidden" fade
    // (Style.css) - taake behavior har jagah bilkul same rahe.
    // ============================================================
    const VIEW_TRANSITION_MS = 220;

    function fadeOutThen(elements, callback) {
        const visible = elements.filter((el) => el && el.style.display !== 'none');
        if (visible.length === 0) {
            callback();
            return;
        }
        visible.forEach((el) => el.classList.add('view-hidden'));
        setTimeout(callback, VIEW_TRANSITION_MS);
    }

    function fadeIn(elements) {
        elements.forEach((el) => { if (el) el.classList.add('view-hidden'); });
        if (elements[0]) void elements[0].offsetWidth; // reflow - taake transition chal sake
        requestAnimationFrame(() => {
            elements.forEach((el) => { if (el) el.classList.remove('view-hidden'); });
        });
    }

    function hidePremiumTab() {
        if (!premiumSection || premiumSection.style.display === 'none') return;
        fadeOutThen([premiumSection], () => {
            premiumSection.style.display = 'none';
        });
    }

    // Turant (bina fade animation ke) chupa deta hai - jab koi doosra tab
    // already apna fade-in animation kar raha ho (overlap/flash se bachne
    // ke liye) - baaki tabs ke *HideXTabInstant pattern jaisa hi.
    function hidePremiumTabInstant() {
        if (premiumSection) premiumSection.style.display = 'none';
    }

    async function showPremiumTab() {
        const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
        const playlistsSection = document.getElementById('playlists-view-section');
        const downloadsSection = document.getElementById('downloads-view-section');
        if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(false);
        // Downloads tab agar khula ho to usko bhi chupa do.
        if (typeof window.melodiaxHideDownloadsTab === 'function') window.melodiaxHideDownloadsTab();
        // About tab agar khula ho to usko turant chupa do (naya tab khud
        // apna fade-in karega, isliye yahan animation ki zaroorat nahi -
        // warna overlap ki wajah se "jhalak" dikhti hai).
        if (typeof window.melodiaxHideAboutTabInstant === 'function') window.melodiaxHideAboutTabInstant();

        await loadPremiumPlans();

        fadeOutThen([...homeSections, playlistsSection, downloadsSection], () => {
            homeSections.forEach((sec) => { sec.style.display = 'none'; });
            if (playlistsSection) playlistsSection.style.display = 'none';
            if (downloadsSection) downloadsSection.style.display = 'none';
            if (premiumSection) {
                premiumSection.style.display = 'block';
                fadeIn([premiumSection]);
            }
        });
    }

    if (navPremiumBtn) navPremiumBtn.addEventListener('click', showPremiumTab);
    if (homeIconEl) homeIconEl.addEventListener('click', hidePremiumTab);

    // Baaki tabs (Playlist/Downloads/About) ko available karwana taake wo
    // bhi Premium tab ko hide kar saken jab unpar seedha switch kiya jaye.
    window.melodiaxHidePremiumTab = hidePremiumTab;
    window.melodiaxHidePremiumTabInstant = hidePremiumTabInstant;

    // ============================================================
    // ---------------- Admin: pencil button visibility ----------------
    // ============================================================
    function updatePremiumEditBtnVisibility() {
        if (!premiumEditBtn) return;
        premiumEditBtn.style.display = (typeof isAdminUser === 'function' && isAdminUser()) ? 'flex' : 'none';
        renderPremiumCards(); // guest/admin switch hone par empty-state bhi update ho
    }
    window.addEventListener('melodiax-auth-changed', updatePremiumEditBtnVisibility);

    // ============================================================
    // ---------------- Admin: manage panel (add/edit/delete plans) ----------------
    // ============================================================
    if (premiumEditBtn) premiumEditBtn.addEventListener('click', openPremiumPanel);
    if (premiumPanelClose) premiumPanelClose.addEventListener('click', closePremiumPanel);
    if (premiumPanelOverlay) premiumPanelOverlay.addEventListener('click', closePremiumPanel);

    function openPremiumPanel() {
        cancelPremiumEdit();
        renderPremiumList();
        premiumPanel.classList.add('open');
        premiumPanelOverlay.classList.add('open');
    }
    function closePremiumPanel() {
        premiumPanel.classList.remove('open');
        premiumPanelOverlay.classList.remove('open');
    }

    // ---------------- Color swatches ----------------
    if (premiumSwatchesWrap) {
        premiumSwatchesWrap.querySelectorAll('.pbanner-swatch').forEach((btn) => {
            btn.addEventListener('click', () => selectPremiumColor(btn.dataset.color, btn));
        });
    }
    if (premiumColorCustom) {
        premiumColorCustom.addEventListener('input', () => selectPremiumColor(premiumColorCustom.value, null));
    }
    function selectPremiumColor(color, activeSwatchBtn) {
        premiumColorInput.value = color;
        premiumColorCustom.value = color;
        premiumSwatchesWrap.querySelectorAll('.pbanner-swatch').forEach((b) => {
            b.classList.toggle('active', b === activeSwatchBtn);
        });
    }

    // ---------------- Cover image preview ----------------
    if (premiumImageInput) {
        premiumImageInput.addEventListener('change', () => {
            const file = premiumImageInput.files[0];
            if (file) {
                premiumImagePreview.src = URL.createObjectURL(file);
                premiumImagePreview.style.display = 'block';
            } else {
                premiumImagePreview.style.display = 'none';
            }
        });
    }

    // ---------------- Form messages ----------------
    function showPremiumError(msg) {
        premiumFormSuccess.classList.remove('visible');
        premiumFormError.textContent = msg;
        premiumFormError.classList.add('visible');
    }
    function showPremiumSuccess(msg) {
        premiumFormError.classList.remove('visible');
        premiumFormSuccess.textContent = msg;
        premiumFormSuccess.classList.add('visible');
    }
    function clearPremiumMessages() {
        premiumFormError.classList.remove('visible');
        premiumFormSuccess.classList.remove('visible');
    }

    // ---------------- List of existing plans (inside the panel) ----------------
    function renderPremiumList() {
        premiumList.innerHTML = '';
        premiumPlans.forEach((p) => premiumList.appendChild(buildPremiumRow(p)));
    }
    function buildPremiumRow(p) {
        const row = document.createElement('div');
        row.className = 'admin-song-row';
        row.dataset.planId = p._id;
        row.innerHTML = `
            <div class="admin-song-row-swatch" style="background: ${escapeHtml(p.color || '#1db954')};"></div>
            <div class="admin-song-meta">
                <strong>${escapeHtml(p.name)}</strong>
                <span>${p.price ? escapeHtml(p.price) : 'No price set'}</span>
            </div>
            <div class="admin-song-actions">
                <button type="button" class="admin-song-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="admin-song-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        row.querySelector('.admin-song-edit').addEventListener('click', () => startPremiumEdit(p));
        row.querySelector('.admin-song-delete').addEventListener('click', () => deletePremiumPlan(p._id, row));
        return row;
    }

    function startPremiumEdit(p) {
        premiumEditId.value = p._id;
        premiumNameInput.value = p.name || '';
        premiumPriceInput.value = p.price || '';
        premiumTaglineInput.value = p.tagline || '';
        premiumBadgeInput.value = p.badge || '';
        premiumFeaturesInput.value = (p.features || []).join('\n');
        premiumOrderInput.value = (p.order !== undefined && p.order !== null) ? String(p.order) : '0';
        selectPremiumColor(p.color || '#1db954', null);
        premiumImageInput.value = '';
        if (p.image) {
            premiumImagePreview.src = p.image;
            premiumImagePreview.style.display = 'block';
        } else {
            premiumImagePreview.style.display = 'none';
            premiumImagePreview.src = '';
        }

        premiumPanelTitle.innerHTML = '<i class="fa-solid fa-crown"></i> Edit Plan';
        premiumSubmitBtn.textContent = 'Save Changes';
        premiumCancelEditBtn.style.display = 'inline-block';
        clearPremiumMessages();
        premiumPanel.scrollTop = 0;
    }

    function cancelPremiumEdit() {
        premiumForm.reset();
        premiumEditId.value = '';
        premiumImagePreview.style.display = 'none';
        premiumImagePreview.src = '';
        selectPremiumColor('#1db954', premiumSwatchesWrap ? premiumSwatchesWrap.querySelector('.pbanner-swatch') : null);
        premiumPanelTitle.innerHTML = '<i class="fa-solid fa-crown"></i> Premium Plans';
        premiumSubmitBtn.textContent = 'Add Plan';
        premiumCancelEditBtn.style.display = 'none';
        clearPremiumMessages();
    }
    if (premiumCancelEditBtn) premiumCancelEditBtn.addEventListener('click', cancelPremiumEdit);

    // ---------------- Create / Update submit ----------------
    if (premiumForm) {
        premiumForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearPremiumMessages();

            const id = premiumEditId.value;
            const name = premiumNameInput.value.trim();

            if (!name) {
                showPremiumError('Plan name is required');
                return;
            }

            const formData = new FormData();
            formData.append('name', name);
            formData.append('price', premiumPriceInput.value.trim());
            formData.append('tagline', premiumTaglineInput.value.trim());
            formData.append('badge', premiumBadgeInput.value.trim());
            formData.append('features', premiumFeaturesInput.value);
            formData.append('color', premiumColorInput.value);
            formData.append('order', premiumOrderInput.value.trim() || '0');
            // Cover image optional hai - sirf tab bhejte hain jab admin ne
            // nayi file chuni ho (edit mein blank chhodne par purani image bani rehti hai).
            if (premiumImageInput.files[0]) formData.append('image', premiumImageInput.files[0]);

            premiumSubmitBtn.disabled = true;
            try {
                const res = await fetch(id ? `${PREMIUM_API}/${id}` : PREMIUM_API, {
                    method: id ? 'PUT' : 'POST',
                    credentials: 'include',
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) {
                    showPremiumError(data.message || 'Kuch ghalat ho gaya');
                    return;
                }

                if (id) {
                    const idx = premiumPlans.findIndex((p) => p._id === id);
                    if (idx !== -1) premiumPlans[idx] = data.plan;
                } else {
                    premiumPlans.push(data.plan);
                }
                premiumPlans.sort((a, b) => (a.order - b.order) || (new Date(a.createdAt) - new Date(b.createdAt)));

                showPremiumSuccess(data.message || 'Ho gaya!');
                renderPremiumList();
                renderPremiumCards();
                cancelPremiumEdit();
            } catch (err) {
                console.error(err);
                showPremiumError('Could not connect to the server');
            } finally {
                premiumSubmitBtn.disabled = false;
            }
        });
    }

    // ---------------- Delete ----------------
    async function deletePremiumPlan(id, row) {
        const ok = window.showConfirm
            ? await window.showConfirm('Delete this premium plan?', { confirmText: 'Delete' })
            : window.confirm('Delete this premium plan?');
        if (!ok) return;
        try {
            const res = await fetch(`${PREMIUM_API}/${id}`, { method: 'DELETE', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) {
                showPremiumError(data.message || 'Could not delete');
                return;
            }
            premiumPlans = premiumPlans.filter((p) => p._id !== id);
            if (row) row.remove();
            renderPremiumCards();
            if (premiumEditId.value === id) cancelPremiumEdit();
        } catch (err) {
            console.error(err);
            showPremiumError('Could not connect to the server');
        }
    }

    // ---------------- Init ----------------
    updatePremiumEditBtnVisibility();
    loadPremiumPlans();
    // Page load hote hi agar session pehle se maujood hai (auth.js checkSession
    // abhi resolve nahi hua) to bhi jab hoga to 'melodiax-auth-changed' event
    // khud updatePremiumEditBtnVisibility() ko call kar dega.
})();
