// ============================================================
// Homepage "Playlists" slide banner
// ------------------------------------------------------------
// - Public: sirf slides + chhote backward/forward buttons + dots dikhte hain.
//   Autoplay hoti hai, hover par ruk jati hai.
// - Admin: banner ke top-right corner par chhota pencil button dikhta hai,
//   jisse ek slide-in panel khulta hai (bilkul admin-panel/#admin-panel
//   jaisa) - wahan se slides add/edit/delete ki ja sakti hain.
//
// Note: Script.js/admin.js is script se pehle load hote hain (classic,
// non-module <script> tags), is liye unke global helpers (escapeHtml,
// showConfirm - confirm.js se) yahan bhi seedha use ho sakte hain.
// ============================================================

const PLAYLISTS_API = '/api/playlists';

let pbannerSlides = [];
let pbannerIndex = 0;
let pbannerAutoplayTimer = null;

// ---------------- Public banner elements ----------------
const playlistBanner = document.getElementById('playlist-banner');
const playlistBannerTrack = document.getElementById('playlist-banner-track');
const playlistBannerPrev = document.getElementById('playlist-banner-prev');
const playlistBannerNext = document.getElementById('playlist-banner-next');
const playlistBannerDots = document.getElementById('playlist-banner-dots');
const playlistBannerEditBtn = document.getElementById('playlist-banner-edit-btn');

// ---------------- Admin panel elements ----------------
const pbannerPanel = document.getElementById('pbanner-panel');
const pbannerPanelOverlay = document.getElementById('pbanner-panel-overlay');
const pbannerPanelClose = document.getElementById('pbanner-panel-close');
const pbannerForm = document.getElementById('pbanner-form');
const pbannerEditId = document.getElementById('pbanner-edit-id');
const pbannerTitleInput = document.getElementById('pbanner-title');
const pbannerDescriptionInput = document.getElementById('pbanner-description');
const pbannerImageInput = document.getElementById('pbanner-image');
const pbannerImagePreview = document.getElementById('pbanner-image-preview');
const pbannerColorInput = document.getElementById('pbanner-color');
const pbannerColorCustom = document.getElementById('pbanner-color-custom');
const pbannerSwatchesWrap = document.getElementById('pbanner-swatches');
const pbannerSectionInput = document.getElementById('pbanner-section');
const pbannerOrderInput = document.getElementById('pbanner-order');
const pbannerFormError = document.getElementById('pbanner-form-error');
const pbannerFormSuccess = document.getElementById('pbanner-form-success');
const pbannerSubmitBtn = document.getElementById('pbanner-submit-btn');
const pbannerCancelEditBtn = document.getElementById('pbanner-cancel-edit');
const pbannerList = document.getElementById('pbanner-list');

// ============================================================
// ---------------- Public: fetch + render slides ----------------
// ============================================================
async function loadPlaylistBanner() {
    try {
        const res = await fetch(PLAYLISTS_API);
        const data = await res.json();
        pbannerSlides = (data.playlists || []);
    } catch (err) {
        console.warn('Playlist banner load nahi ho saka:', err);
        pbannerSlides = [];
    }
    // Fresh load hamesha pehli slide se shuru ho (next/prev buttons is
    // liye hamesha slide 1 se hi kaam karna shuru karte hain).
    pbannerIndex = 0;
    renderPlaylistBanner();
}

function isAdminUser() {
    return !!(window.currentUser && window.currentUser.isAdmin);
}

function renderPlaylistBanner() {
    const admin = isAdminUser();

    // Agar user is waqt Playlist tab (ya kisi aur non-home view) pe hai to
    // banner ko hidden hi rehne do - ye sirf home page ki cheez hai.
    if (!pbannerHomeVisible) {
        playlistBanner.style.display = 'none';
        return;
    }

    // Guest/normal user ke liye - koi slide na ho to poora banner hi chupa do.
    if (!pbannerSlides.length && !admin) {
        playlistBanner.style.display = 'none';
        return;
    }
    playlistBanner.style.display = 'flex';

    if (!pbannerSlides.length) {
        // Admin ko empty-state dikhao taake use pata chale ye feature yahin se milta hai.
        playlistBannerTrack.innerHTML = `
            <div class="playlist-banner-slide playlist-banner-empty">
                <div class="playlist-banner-slide-info">
                    <span class="playlist-banner-tag">Playlists</span>
                    <h3>No playlist slides yet</h3>
                    <p>Top-right pencil button se pehla slide add karein.</p>
                </div>
            </div>`;
        playlistBannerDots.innerHTML = '';
        playlistBannerPrev.style.display = 'none';
        playlistBannerNext.style.display = 'none';
        stopPlaylistBannerAutoplay();
        return;
    }

    if (pbannerIndex >= pbannerSlides.length) pbannerIndex = 0;

    playlistBannerTrack.innerHTML = pbannerSlides.map((p) => buildSlideHtml(p)).join('');
    playlistBannerDots.innerHTML = pbannerSlides
        .map((_, i) => `<button type="button" class="playlist-banner-dot${i === pbannerIndex ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`)
        .join('');

    const showNav = pbannerSlides.length > 1;
    playlistBannerNext.style.display = showNav ? '' : 'none';
    // Backward button pehli slide pe chupa rehta hai, 2nd/3rd/... se dikhta hai.
    playlistBannerPrev.style.display = (showNav && pbannerIndex > 0) ? '' : 'none';

    // Click par us section ki playlist auto-generate karke Playlist tab pe le jao.
    playlistBannerTrack.querySelectorAll('.playlist-banner-slide[data-section]').forEach((el, i) => {
        el.addEventListener('click', () => openBannerSlidePlaylist(pbannerSlides[i]));
    });

    updatePlaylistBannerPosition();
    if (showNav) startPlaylistBannerAutoplay(); else stopPlaylistBannerAutoplay();
}

function buildSlideHtml(p) {
    const clickable = p.linkedSection ? ` data-section="${escapeHtml(p.linkedSection)}"` : '';
    const cursor = p.linkedSection ? ' style="cursor:pointer;"' : '';
    return `
        <div class="playlist-banner-slide"${clickable}${cursor}>
            <div class="playlist-banner-bg" style="background: linear-gradient(135deg, ${escapeHtml(p.bgColor || '#2563eb')}, #0d0d0dcc);"></div>
            <img class="playlist-banner-slide-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}">
            <div class="playlist-banner-overlay"></div>
            <div class="playlist-banner-slide-info">
                <span class="playlist-banner-tag">Playlist</span>
                <h3>${escapeHtml(p.title)}</h3>
                ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
            </div>
        </div>`;
}

// Section ke andar maujood ".playMusic" icons se us section ke sab song-ids nikalo
// (ye wahi id format hai jo playlist.js/Script.js already use karte hain).
function getSectionSongIds(name) {
    if (!name) return [];
    const sections = document.querySelectorAll('.music-section');
    for (const section of sections) {
        const h2 = section.querySelector('h2');
        if (h2 && h2.textContent.trim().toLowerCase() === name.trim().toLowerCase()) {
            return Array.from(section.querySelectorAll('.playMusic')).map((el) => el.id).filter(Boolean);
        }
    }
    return [];
}

// Banner slide pe click -> us section ki playlist (cover image = banner ki
// cover image) auto bana/update karo, aur seedha bara (80% screen) detail
// module khol do - homepage se Playlist tab pe switch nahi karte, playlist
// khud-ba-khud Playlist tab ke andar create ho jati hai (sidebar me nahi
// dikhti, sirf Playlist tab ki grid me).
function openBannerSlidePlaylist(p) {
    if (!p || !p.linkedSection) return;
    const songIds = getSectionSongIds(p.linkedSection);
    if (songIds.length && typeof window.melodiaxOpenSectionPlaylist === 'function') {
        window.melodiaxOpenSectionPlaylist(p.linkedSection, p.image, songIds);
    } else {
        // Fallback: playlist module load nahi hua ya section me songs nahi mile
        scrollToSection(p.linkedSection);
    }
}

function updatePlaylistBannerPosition() {
    playlistBannerTrack.style.transform = `translateX(-${pbannerIndex * 100}%)`;
    playlistBannerDots.querySelectorAll('.playlist-banner-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === pbannerIndex);
    });
    // Backward button sirf 1st slide (index 0) pe gayab hota hai, baaki (2nd,
    // 3rd, 4th ... ongoing) sab slides pe dikhta hai.
    if (playlistBannerPrev) {
        playlistBannerPrev.style.display = (pbannerSlides.length > 1 && pbannerIndex > 0) ? '' : 'none';
    }
}

function goToSlide(index) {
    if (!pbannerSlides.length) return;
    const total = pbannerSlides.length;
    pbannerIndex = ((index % total) + total) % total;
    updatePlaylistBannerPosition();
}
function nextSlide() { goToSlide(pbannerIndex + 1); }
function prevSlide() { goToSlide(pbannerIndex - 1); }

function startPlaylistBannerAutoplay() {
    stopPlaylistBannerAutoplay();
    pbannerAutoplayTimer = setInterval(nextSlide, 5000);
}
function stopPlaylistBannerAutoplay() {
    if (pbannerAutoplayTimer) clearInterval(pbannerAutoplayTimer);
    pbannerAutoplayTimer = null;
}

if (playlistBannerPrev) playlistBannerPrev.addEventListener('click', () => { prevSlide(); startPlaylistBannerAutoplay(); });
if (playlistBannerNext) playlistBannerNext.addEventListener('click', () => { nextSlide(); startPlaylistBannerAutoplay(); });
if (playlistBannerDots) {
    playlistBannerDots.addEventListener('click', (e) => {
        const dot = e.target.closest('.playlist-banner-dot');
        if (!dot) return;
        goToSlide(parseInt(dot.dataset.index, 10));
        startPlaylistBannerAutoplay();
    });
}
if (playlistBanner) {
    playlistBanner.addEventListener('mouseenter', stopPlaylistBannerAutoplay);
    playlistBanner.addEventListener('mouseleave', () => { if (pbannerSlides.length > 1) startPlaylistBannerAutoplay(); });
}

// linkedSection naam se match hone wala homepage <h2> section dhoondh kar wahan scroll karo
function scrollToSection(name) {
    if (!name) return;
    const sections = document.querySelectorAll('.music-section');
    for (const section of sections) {
        const h2 = section.querySelector('h2');
        if (h2 && h2.textContent.trim().toLowerCase() === name.trim().toLowerCase()) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
    }
}

// ============================================================
// ---------------- Admin: show/hide edit button on login state change ----------------
// ============================================================
function updateAdminEditBtnVisibility() {
    if (!playlistBannerEditBtn) return;
    playlistBannerEditBtn.style.display = isAdminUser() ? 'flex' : 'none';
    // Guest -> admin ya admin -> guest hone par empty-state/hide state bhi update ho
    renderPlaylistBanner();
}
window.addEventListener('melodiax-auth-changed', updateAdminEditBtnVisibility);

// ============================================================
// ---------------- Admin: manage panel (add/edit/delete slides) ----------------
// ============================================================
if (playlistBannerEditBtn) playlistBannerEditBtn.addEventListener('click', openPbannerPanel);
if (pbannerPanelClose) pbannerPanelClose.addEventListener('click', closePbannerPanel);
if (pbannerPanelOverlay) pbannerPanelOverlay.addEventListener('click', closePbannerPanel);

function openPbannerPanel() {
    cancelPbannerEdit();
    populatePbannerSectionSuggestions();
    renderPbannerList();
    pbannerPanel.classList.add('open');
    pbannerPanelOverlay.classList.add('open');
}
function closePbannerPanel() {
    pbannerPanel.classList.remove('open');
    pbannerPanelOverlay.classList.remove('open');
}

// Existing music-section <h2> titles ko suggestion ke tor par datalist mein daalo
function populatePbannerSectionSuggestions() {
    const list = document.getElementById('song-section-list');
    if (!list) return;
    const titles = new Set();
    document.querySelectorAll('.music-section > h2').forEach((h2) => titles.add(h2.textContent.trim()));
    list.innerHTML = Array.from(titles).map((t) => `<option value="${escapeHtml(t)}"></option>`).join('');
}

// ---------------- Color swatches ----------------
if (pbannerSwatchesWrap) {
    pbannerSwatchesWrap.querySelectorAll('.pbanner-swatch').forEach((btn) => {
        btn.addEventListener('click', () => selectPbannerColor(btn.dataset.color, btn));
    });
}
if (pbannerColorCustom) {
    pbannerColorCustom.addEventListener('input', () => selectPbannerColor(pbannerColorCustom.value, null));
}
function selectPbannerColor(color, activeSwatchBtn) {
    pbannerColorInput.value = color;
    pbannerColorCustom.value = color;
    pbannerSwatchesWrap.querySelectorAll('.pbanner-swatch').forEach((b) => {
        b.classList.toggle('active', b === activeSwatchBtn);
    });
}

// ---------------- Image preview ----------------
if (pbannerImageInput) {
    pbannerImageInput.addEventListener('change', () => {
        const file = pbannerImageInput.files[0];
        if (file) {
            pbannerImagePreview.src = URL.createObjectURL(file);
            pbannerImagePreview.style.display = 'block';
        } else {
            pbannerImagePreview.style.display = 'none';
        }
    });
}

// ---------------- Form messages ----------------
function showPbannerError(msg) {
    pbannerFormSuccess.classList.remove('visible');
    pbannerFormError.textContent = msg;
    pbannerFormError.classList.add('visible');
}
function showPbannerSuccess(msg) {
    pbannerFormError.classList.remove('visible');
    pbannerFormSuccess.textContent = msg;
    pbannerFormSuccess.classList.add('visible');
}
function clearPbannerMessages() {
    pbannerFormError.classList.remove('visible');
    pbannerFormSuccess.classList.remove('visible');
}

// ---------------- List of existing slides (inside the panel) ----------------
function renderPbannerList() {
    pbannerList.innerHTML = '';
    pbannerSlides.forEach((p) => pbannerList.appendChild(buildPbannerRow(p)));
}
function buildPbannerRow(p) {
    const row = document.createElement('div');
    row.className = 'admin-song-row';
    row.dataset.playlistId = p._id;
    row.innerHTML = `
        <img src="${escapeHtml(p.image)}" alt="">
        <div class="admin-song-meta">
            <strong>${escapeHtml(p.title)}</strong>
            <span>${p.linkedSection ? escapeHtml(p.linkedSection) : 'No linked section'}</span>
        </div>
        <div class="admin-song-actions">
            <button type="button" class="admin-song-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="admin-song-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    row.querySelector('.admin-song-edit').addEventListener('click', () => startPbannerEdit(p));
    row.querySelector('.admin-song-delete').addEventListener('click', () => deletePbannerSlide(p._id, row));
    return row;
}

function startPbannerEdit(p) {
    pbannerEditId.value = p._id;
    pbannerTitleInput.value = p.title || '';
    pbannerDescriptionInput.value = p.description || '';
    pbannerSectionInput.value = p.linkedSection || '';
    pbannerOrderInput.value = (p.order !== undefined && p.order !== null) ? String(p.order) : '0';
    selectPbannerColor(p.bgColor || '#2563eb', null);
    pbannerImageInput.value = '';
    pbannerImagePreview.src = p.image;
    pbannerImagePreview.style.display = 'block';

    document.getElementById('pbanner-panel-title').innerHTML = '<i class="fa-solid fa-images"></i> Edit Slide';
    pbannerSubmitBtn.textContent = 'Save Changes';
    pbannerCancelEditBtn.style.display = 'inline-block';
    clearPbannerMessages();
    pbannerPanel.scrollTop = 0;
}

function cancelPbannerEdit() {
    pbannerForm.reset();
    pbannerEditId.value = '';
    pbannerImagePreview.style.display = 'none';
    pbannerImagePreview.src = '';
    selectPbannerColor('#2563eb', pbannerSwatchesWrap ? pbannerSwatchesWrap.querySelector('.pbanner-swatch') : null);
    document.getElementById('pbanner-panel-title').innerHTML = '<i class="fa-solid fa-images"></i> Playlists Banner';
    pbannerSubmitBtn.textContent = 'Add Slide';
    pbannerCancelEditBtn.style.display = 'none';
    clearPbannerMessages();
}
if (pbannerCancelEditBtn) pbannerCancelEditBtn.addEventListener('click', cancelPbannerEdit);

// ---------------- Create / Update submit ----------------
if (pbannerForm) {
    pbannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearPbannerMessages();

        const id = pbannerEditId.value;
        const formData = new FormData();
        formData.append('title', pbannerTitleInput.value.trim());
        formData.append('description', pbannerDescriptionInput.value.trim());
        formData.append('bgColor', pbannerColorInput.value);
        formData.append('linkedSection', pbannerSectionInput.value.trim());
        formData.append('order', pbannerOrderInput.value.trim() || '0');
        if (pbannerImageInput.files[0]) formData.append('image', pbannerImageInput.files[0]);

        if (!id && !pbannerImageInput.files[0]) {
            showPbannerError('Playlist ki cover image zaroori hai');
            return;
        }

        pbannerSubmitBtn.disabled = true;
        try {
            const res = await fetch(id ? `${PLAYLISTS_API}/${id}` : PLAYLISTS_API, {
                method: id ? 'PUT' : 'POST',
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                showPbannerError(data.message || 'Kuch ghalat ho gaya');
                return;
            }

            if (id) {
                const idx = pbannerSlides.findIndex((p) => p._id === id);
                if (idx !== -1) pbannerSlides[idx] = data.playlist;
            } else {
                pbannerSlides.push(data.playlist);
            }
            pbannerSlides.sort((a, b) => (a.order - b.order) || (new Date(a.createdAt) - new Date(b.createdAt)));

            showPbannerSuccess(data.message || 'Ho gaya!');
            renderPbannerList();
            renderPlaylistBanner();
            cancelPbannerEdit();
        } catch (err) {
            console.error(err);
            showPbannerError('Server se connect nahi ho saka');
        } finally {
            pbannerSubmitBtn.disabled = false;
        }
    });
}

// ---------------- Delete ----------------
async function deletePbannerSlide(id, row) {
    const ok = await window.showConfirm('Ye playlist slide delete karna hai?', { confirmText: 'Delete' });
    if (!ok) return;
    try {
        const res = await fetch(`${PLAYLISTS_API}/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) {
            showPbannerError(data.message || 'Delete nahi ho saka');
            return;
        }
        pbannerSlides = pbannerSlides.filter((p) => p._id !== id);
        if (row) row.remove();
        renderPlaylistBanner();
        if (pbannerEditId.value === id) cancelPbannerEdit();
    } catch (err) {
        console.error(err);
        showPbannerError('Server se connect nahi ho saka');
    }
}

// ---------------- Home-page-only visibility ----------------
// Playlist tab (ya kisi aur non-home view) pe switch hote waqt playlist.js
// isko call karta hai taake banner sirf home page pe hi nazar aaye.
let pbannerHomeVisible = true;
window.melodiaxSetHomeBannerVisible = function (visible) {
    pbannerHomeVisible = !!visible;
    if (pbannerHomeVisible) {
        renderPlaylistBanner(); // apni normal display state (flex/none) khud dobara set kar leta hai
    } else if (playlistBanner) {
        playlistBanner.style.display = 'none';
    }
};

// ---------------- Init ----------------
loadPlaylistBanner();
// Page load hote hi agar session pehle se maujood hai (auth.js checkSession
// abhi resolve nahi hua) to bhi jab hoga to 'melodiax-auth-changed' event khud
// updateAdminEditBtnVisibility() ko call kar dega.
