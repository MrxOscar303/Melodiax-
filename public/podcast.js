// ============================================================
// Educational Hub ("Browse Podcasts")
// ------------------------------------------------------------
// - Public: 95% screen module - search bar + category tabs (Physics,
//   Math, Philosophy, History, Biology, ya koi bhi naya naam jo admin
//   ne use kiya ho) + 2-per-row bari cards. Card click = neeche wale
//   main player-bar (audio/YouTube, dono) se play hota hai, projector
//   video bhi (agar admin ne ON kiya ho) sync ho jati hai.
// - Admin: top-right corner me "+" icon se ek alag panel khulta hai
//   (bilkul #admin-panel/song form jaisa hi) jahan se content
//   add/edit/delete hoti hai.
//
// Note: Script.js/admin.js pehle load ho chuke hote hain (classic
// scripts, shared global scope) - is liye unke globals (audio, play,
// startYoutubeTrack, updateNowBar, makeAllPlay, escapeHtml,
// showConfirm) yahan seedha use ho sakte hain.
// ============================================================

const PODCASTS_API = '/api/podcasts';
const DEFAULT_PODCAST_CATEGORIES = ['Physics', 'Math', 'Philosophy', 'History', 'Biology'];

let podcastItems = [];
let podcastActiveCategory = 'All';
let podcastSearchTerm = '';

// ---------------- Hub elements ----------------
const podcastHubOverlay = document.getElementById('podcast-hub-overlay');
const podcastHubModal = document.getElementById('podcast-hub-modal');
const podcastHubCloseBtn = document.getElementById('podcast-hub-close');
const podcastHubAdminBtn = document.getElementById('podcast-hub-admin-btn');
const podcastHubSearchInput = document.getElementById('podcast-hub-search');
const podcastHubTabs = document.getElementById('podcast-hub-tabs');
const podcastHubGrid = document.getElementById('podcast-hub-grid');
const podcastHubEmpty = document.getElementById('podcast-hub-empty');

// ---------------- Admin panel elements ----------------
const podcastAdminPanel = document.getElementById('podcast-admin-panel');
const podcastAdminOverlay = document.getElementById('podcast-admin-overlay');
const podcastAdminCloseBtn = document.getElementById('podcast-admin-close');
const podcastAdminForm = document.getElementById('podcast-admin-form');
const podcastAdminFormError = document.getElementById('podcast-admin-form-error');
const podcastAdminFormSuccess = document.getElementById('podcast-admin-form-success');
const podcastAdminList = document.getElementById('podcast-admin-list');
const podcastAdminTitle = document.getElementById('podcast-admin-title');
const podcastAdminSubmitBtn = document.getElementById('podcast-admin-submit-btn');
const podcastAdminCancelBtn = document.getElementById('podcast-admin-cancel-edit');
const podcastAdminEditId = { value: '' }; // simple holder, no hidden input needed

const podcastImageInput = document.getElementById('podcast-image');
const podcastImagePreview = document.getElementById('podcast-image-preview');

// ---------------- Source (YouTube vs Mp3) toggle ----------------
const podcastSourceTypeInput = document.getElementById('podcast-source-type');
const podcastSourceYesNo = document.getElementById('podcast-source-yesno');
const podcastYoutubeUrlField = document.getElementById('podcast-youtube-url-field');
const podcastYoutubeUrlInput = document.getElementById('podcast-youtube-url');
const podcastAudioFileField = document.getElementById('podcast-audio-file-field');
const podcastAudioFileInput = document.getElementById('podcast-audio-file');
const podcastAudioFileName = document.getElementById('podcast-audio-file-name');
const podcastMp4FileField = document.getElementById('podcast-mp4-file-field');
const podcastMp4FileInput = document.getElementById('podcast-mp4-file');
const podcastMp4FileName = document.getElementById('podcast-mp4-file-name');
const podcastProjectorSection = document.getElementById('podcast-projector-section');
const podcastMp4ProjectorNote = document.getElementById('podcast-mp4-projector-note');

function setPodcastSourceType(type) {
    podcastSourceTypeInput.value = type;
    if (podcastSourceYesNo) {
        podcastSourceYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.value === type);
        });
    }
    if (podcastYoutubeUrlField) podcastYoutubeUrlField.style.display = type === 'youtube' ? '' : 'none';
    if (podcastAudioFileField) podcastAudioFileField.style.display = type === 'mp3' ? '' : 'none';
    if (podcastMp4FileField) podcastMp4FileField.style.display = type === 'mp4' ? '' : 'none';
    if (type !== 'mp3') {
        if (podcastAudioFileInput) podcastAudioFileInput.value = '';
        if (podcastAudioFileName) podcastAudioFileName.textContent = '';
    }
    if (type !== 'mp4') {
        if (podcastMp4FileInput) podcastMp4FileInput.value = '';
        if (podcastMp4FileName) podcastMp4FileName.textContent = '';
    }
    // Mp4 mode mein projector automatic hai - manual toggle chupa do
    if (podcastProjectorSection) podcastProjectorSection.style.display = type === 'mp4' ? 'none' : '';
    if (podcastMp4ProjectorNote) podcastMp4ProjectorNote.style.display = type === 'mp4' ? 'block' : 'none';
    if (type === 'mp4') setPodcastProjectorEnabled(false); // form submit ke waqt purani value bhej kar backend confuse na kare
}
if (podcastMp4FileInput) {
    podcastMp4FileInput.addEventListener('change', () => {
        const file = podcastMp4FileInput.files[0];
        if (podcastMp4FileName) podcastMp4FileName.textContent = file ? file.name : '';
    });
}
if (podcastSourceYesNo) {
    podcastSourceYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
        btn.addEventListener('click', () => setPodcastSourceType(btn.dataset.value));
    });
}
if (podcastAudioFileInput) {
    podcastAudioFileInput.addEventListener('change', () => {
        const file = podcastAudioFileInput.files[0];
        if (podcastAudioFileName) podcastAudioFileName.textContent = file ? file.name : '';
    });
}

// ---------------- Projector video toggle ----------------
const podcastProjectorEnabledInput = document.getElementById('podcast-projector-enabled');
const podcastProjectorYesNo = document.getElementById('podcast-projector-yesno');
const podcastProjectorVideoField = document.getElementById('podcast-projector-video-field');
const podcastProjectorVideoInput = document.getElementById('podcast-projector-video');
const podcastProjectorVideoPreview = document.getElementById('podcast-projector-video-preview');

function setPodcastProjectorEnabled(enabled) {
    podcastProjectorEnabledInput.value = enabled ? 'true' : 'false';
    if (podcastProjectorYesNo) {
        podcastProjectorYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
            btn.classList.toggle('active', (btn.dataset.value === 'yes') === enabled);
        });
    }
    if (podcastProjectorVideoField) podcastProjectorVideoField.style.display = enabled ? '' : 'none';
    if (!enabled) {
        podcastProjectorVideoInput.value = '';
        podcastProjectorVideoPreview.style.display = 'none';
        podcastProjectorVideoPreview.src = '';
    }
}
if (podcastProjectorYesNo) {
    podcastProjectorYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
        btn.addEventListener('click', () => setPodcastProjectorEnabled(btn.dataset.value === 'yes'));
    });
}
if (podcastProjectorVideoInput) {
    podcastProjectorVideoInput.addEventListener('change', () => {
        const file = podcastProjectorVideoInput.files[0];
        if (file) {
            podcastProjectorVideoPreview.src = URL.createObjectURL(file);
            podcastProjectorVideoPreview.style.display = 'block';
        } else {
            podcastProjectorVideoPreview.style.display = 'none';
        }
    });
}
if (podcastImageInput) {
    podcastImageInput.addEventListener('change', () => {
        const file = podcastImageInput.files[0];
        if (file) {
            podcastImagePreview.src = URL.createObjectURL(file);
            podcastImagePreview.style.display = 'block';
        } else {
            podcastImagePreview.style.display = 'none';
        }
    });
}

// ---------------- Admin check ----------------
function isAdminUserPodcast() {
    return !!(window.currentUser && window.currentUser.isAdmin);
}
function updatePodcastAdminBtnVisibility() {
    if (podcastHubAdminBtn) podcastHubAdminBtn.style.display = isAdminUserPodcast() ? 'flex' : 'none';
}
window.addEventListener('melodiax-auth-changed', updatePodcastAdminBtnVisibility);
updatePodcastAdminBtnVisibility();

// ============================================================
// ---------------- Fetch + render hub ----------------
// ============================================================
async function loadPodcasts() {
    try {
        const res = await fetch(PODCASTS_API);
        const data = await res.json();
        podcastItems = data.podcasts || [];
    } catch (err) {
        console.warn('Podcasts failed to load:', err);
        podcastItems = [];
    }
    renderPodcastTabs();
    renderPodcastGrid();
}

function getAllCategories() {
    const found = new Set(DEFAULT_PODCAST_CATEGORIES);
    podcastItems.forEach((p) => { if (p.category) found.add(p.category); });
    return Array.from(found);
}

function renderPodcastTabs() {
    const categories = ['All', ...getAllCategories()];
    podcastHubTabs.innerHTML = categories.map((cat) => `
        <button type="button" class="podcast-hub-tab${cat === podcastActiveCategory ? ' active' : ''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
    `).join('');
    podcastHubTabs.querySelectorAll('.podcast-hub-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            podcastActiveCategory = btn.dataset.cat;
            renderPodcastTabs();
            renderPodcastGrid();
        });
    });
}

function podcastThumbnail(p) {
    if (p.image) return p.image;
    if (p.sourceType === 'youtube' && p.youtubeId) return `https://img.youtube.com/vi/${p.youtubeId}/maxresdefault.jpg`;
    return '/assets/default-song-cover.svg';
}

// Seconds ko YouTube jaisa "m:ss" ya "h:mm:ss" format mein dikhata hai.
function formatPodcastDuration(totalSeconds) {
    const secs = Math.round(totalSeconds || 0);
    if (!secs) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Cross-origin (Cloudinary) file ko force-download karta hai - sirf naya tab
// kholne ki bajaye seedha device par save karwata hai.
async function downloadPodcastFile(url, filename) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.warn('Download failed, opening in new tab instead:', err);
        window.open(url, '_blank');
    }
}

function renderPodcastGrid() {
    const term = podcastSearchTerm.trim().toLowerCase();
    const filtered = podcastItems.filter((p) => {
        const matchesCategory = podcastActiveCategory === 'All' || p.category === podcastActiveCategory;
        const matchesSearch = !term
            || (p.title && p.title.toLowerCase().includes(term))
            || (p.description && p.description.toLowerCase().includes(term))
            || (p.category && p.category.toLowerCase().includes(term));
        return matchesCategory && matchesSearch;
    });

    if (!filtered.length) {
        podcastHubGrid.innerHTML = '';
        podcastHubEmpty.style.display = 'block';
        return;
    }
    podcastHubEmpty.style.display = 'none';

    podcastHubGrid.innerHTML = filtered.map((p) => `
        <div class="podcast-hub-card" data-id="${p._id}">
            <div class="podcast-hub-card-thumb">
                <img src="${escapeHtml(podcastThumbnail(p))}" alt="">
                <div class="podcast-hub-card-play"><i class="fa-solid fa-play"></i></div>
                ${formatPodcastDuration(p.duration) ? `<span class="podcast-hub-card-duration">${formatPodcastDuration(p.duration)}</span>` : ''}
            </div>
            <div class="podcast-hub-card-info">
                <span class="podcast-hub-card-cat">${escapeHtml(p.category)}</span>
                <h4>${escapeHtml(p.title)}</h4>
                ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
                ${p.sourceType !== 'youtube' && p.audioFile ? `
                <button type="button" class="podcast-hub-card-download" title="Download" data-url="${escapeHtml(p.audioFile)}" data-name="${escapeHtml(p.title)}">
                    <i class="fa-solid fa-download"></i>
                </button>` : ''}
            </div>
        </div>
    `).join('');

    podcastHubGrid.querySelectorAll('.podcast-hub-card-download').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // card ka play click trigger na ho
            downloadPodcastFile(btn.dataset.url, btn.dataset.name);
        });
    });

    podcastHubGrid.querySelectorAll('.podcast-hub-card').forEach((card) => {
        card.addEventListener('click', () => {
            const p = podcastItems.find((item) => item._id === card.dataset.id);
            if (p) playPodcast(p);
        });
    });
}

if (podcastHubSearchInput) {
    podcastHubSearchInput.addEventListener('input', () => {
        podcastSearchTerm = podcastHubSearchInput.value;
        renderPodcastGrid();
    });
}

// ============================================================
// ---------------- Playback ----------------
// Direct/synchronous (no `await` from a user-gesture click tak koi
// bhi audio.play()/playVideo() ke pehle) - warna iOS Safari/Chrome
// (WebKit) is call ko silently reject kar deta hai (button "pause"
// dikhata hai lekin kuch bajta nahi).
// ============================================================
function playPodcast(p) {
    if (typeof makeAllPlay === 'function') makeAllPlay();

    // Module band kar do taake user ko sirf neeche wala music player (aur
    // agar projector video hai to wo) dikhe - module khud disturb na kare.
    closePodcastHub();

    // ---------- Projector video (agar admin ne ON kiya ho) ----------
    const projectorContainer = document.getElementById('projector-overlay');
    const projectorVid = document.getElementById('projector-video');
    const mainRightPart = document.querySelector('.main-right-part');
    if (projectorVid) {
        projectorVid.pause();
        projectorVid.src = '';
    }
    if (projectorContainer) projectorContainer.style.display = 'none';
    if (mainRightPart) mainRightPart.classList.remove('songs-fade-out');
    if (typeof hideProjectorBtn === 'function') hideProjectorBtn();

    if (p.projectorEnabled && p.projectorVideo && projectorVid && projectorContainer) {
        projectorVid.src = p.projectorVideo;
        projectorContainer.style.display = 'block';
        projectorVid.load();
        projectorVid.play().catch(() => {});
        if (mainRightPart) mainRightPart.classList.add('songs-fade-out');
        if (typeof showProjectorBtn === 'function') showProjectorBtn();
    }

    // ---------- Audio/YouTube ----------
    if (p.sourceType === 'youtube') {
        startYoutubeTrack({ youtubeId: p.youtubeId });
    } else {
        audio.src = p.audioFile;
        audio.currentTime = 0;
        audio.play().catch((err) => console.warn('Podcast playback failed:', err));
        play.classList.remove('fa-circle-play');
        play.classList.add('fa-circle-pause');
    }

    updateNowBar({
        songImage: podcastThumbnail(p),
        songName: p.title,
        songDes: p.category,
    });
}

// ============================================================
// ---------------- Hub open/close ----------------
// ============================================================
function openPodcastHub() {
    podcastHubModal.classList.add('open');
    podcastHubOverlay.classList.add('open');
    podcastHubModal.setAttribute('aria-hidden', 'false');
    loadPodcasts();
}
function closePodcastHub() {
    podcastHubModal.classList.remove('open');
    podcastHubOverlay.classList.remove('open');
    podcastHubModal.setAttribute('aria-hidden', 'true');
}
const browsePodcastsBtn = document.getElementById('browse-podcasts-btn');
if (browsePodcastsBtn) browsePodcastsBtn.addEventListener('click', openPodcastHub);
if (podcastHubCloseBtn) podcastHubCloseBtn.addEventListener('click', closePodcastHub);
if (podcastHubOverlay) podcastHubOverlay.addEventListener('click', closePodcastHub);

// ============================================================
// ---------------- Admin: panel open/close ----------------
// ============================================================
function openPodcastAdminPanel() {
    cancelPodcastEdit();
    podcastAdminPanel.classList.add('open');
    podcastAdminOverlay.classList.add('open');
    renderPodcastAdminList();
}
function closePodcastAdminPanel() {
    podcastAdminPanel.classList.remove('open');
    podcastAdminOverlay.classList.remove('open');
}
if (podcastHubAdminBtn) podcastHubAdminBtn.addEventListener('click', openPodcastAdminPanel);
if (podcastAdminCloseBtn) podcastAdminCloseBtn.addEventListener('click', closePodcastAdminPanel);
if (podcastAdminOverlay) podcastAdminOverlay.addEventListener('click', closePodcastAdminPanel);

// ---------------- Messages ----------------
function showPodcastAdminError(msg) {
    podcastAdminFormSuccess.classList.remove('visible');
    podcastAdminFormError.textContent = msg;
    podcastAdminFormError.classList.add('visible');
}
function showPodcastAdminSuccess(msg) {
    podcastAdminFormError.classList.remove('visible');
    podcastAdminFormSuccess.textContent = msg;
    podcastAdminFormSuccess.classList.add('visible');
}
function clearPodcastAdminMessages() {
    podcastAdminFormError.classList.remove('visible');
    podcastAdminFormSuccess.classList.remove('visible');
}

// ---------------- Existing content list (inside admin panel) ----------------
function renderPodcastAdminList() {
    podcastAdminList.innerHTML = '';
    podcastItems.forEach((p) => podcastAdminList.appendChild(buildPodcastAdminRow(p)));
}
function buildPodcastAdminRow(p) {
    const row = document.createElement('div');
    row.className = 'admin-song-row';
    row.dataset.podcastId = p._id;
    row.innerHTML = `
        <img src="${escapeHtml(podcastThumbnail(p))}" alt="">
        <div class="admin-song-meta">
            <strong>${escapeHtml(p.title)}</strong>
            <span>${escapeHtml(p.category)}</span>
        </div>
        <div class="admin-song-actions">
            <button type="button" class="admin-song-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="admin-song-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    row.querySelector('.admin-song-edit').addEventListener('click', () => startPodcastEdit(p));
    row.querySelector('.admin-song-delete').addEventListener('click', () => deletePodcast(p._id, row));
    return row;
}

function startPodcastEdit(p) {
    podcastAdminEditId.value = p._id;
    setPodcastSourceType(p.sourceType || 'youtube');
    podcastYoutubeUrlInput.value = p.youtubeUrl || '';
    podcastAudioFileInput.value = '';
    podcastAudioFileName.textContent = '';
    podcastMp4FileInput.value = '';
    podcastMp4FileName.textContent = '';
    document.getElementById('podcast-title').value = p.title || '';
    document.getElementById('podcast-description').value = p.description || '';
    document.getElementById('podcast-category').value = p.category || '';
    podcastImageInput.value = '';
    if (p.image) {
        podcastImagePreview.src = p.image;
        podcastImagePreview.style.display = 'block';
    } else {
        podcastImagePreview.style.display = 'none';
    }
    setPodcastProjectorEnabled(!!p.projectorEnabled);
    if (p.projectorEnabled && p.projectorVideo) {
        podcastProjectorVideoPreview.src = p.projectorVideo;
        podcastProjectorVideoPreview.style.display = 'block';
    }

    podcastAdminTitle.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> Edit Content';
    podcastAdminSubmitBtn.textContent = 'Save Changes';
    podcastAdminCancelBtn.style.display = 'inline-block';
    clearPodcastAdminMessages();
    podcastAdminPanel.scrollTop = 0;
}

function cancelPodcastEdit() {
    podcastAdminForm.reset();
    podcastAdminEditId.value = '';
    setPodcastSourceType('youtube');
    setPodcastProjectorEnabled(false);
    podcastImagePreview.style.display = 'none';
    podcastImagePreview.src = '';
    podcastAdminTitle.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> Add Content';
    podcastAdminSubmitBtn.textContent = 'Add Content';
    podcastAdminCancelBtn.style.display = 'none';
    clearPodcastAdminMessages();
}
if (podcastAdminCancelBtn) podcastAdminCancelBtn.addEventListener('click', cancelPodcastEdit);

// ---------------- Create / Update submit ----------------
if (podcastAdminForm) {
    podcastAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearPodcastAdminMessages();

        const id = podcastAdminEditId.value;
        const sourceType = podcastSourceTypeInput.value;
        const formData = new FormData();
        formData.append('title', document.getElementById('podcast-title').value.trim());
        formData.append('description', document.getElementById('podcast-description').value.trim());
        formData.append('category', document.getElementById('podcast-category').value.trim());
        formData.append('sourceType', sourceType);
        formData.append('projectorEnabled', podcastProjectorEnabledInput.value);

        if (sourceType === 'mp3') {
            if (podcastAudioFileInput.files[0]) formData.append('audio', podcastAudioFileInput.files[0]);
        } else if (sourceType === 'mp4') {
            if (podcastMp4FileInput.files[0]) formData.append('mp4File', podcastMp4FileInput.files[0]);
        } else {
            formData.append('youtubeUrl', podcastYoutubeUrlInput.value.trim());
        }
        if (podcastImageInput.files[0]) formData.append('image', podcastImageInput.files[0]);
        if (podcastProjectorVideoInput.files[0]) formData.append('projectorVideo', podcastProjectorVideoInput.files[0]);

        if (!id && sourceType === 'mp3' && !podcastAudioFileInput.files[0]) {
            showPodcastAdminError('Mp3 file upload is required');
            return;
        }
        if (!id && sourceType === 'mp4' && !podcastMp4FileInput.files[0]) {
            showPodcastAdminError('Mp4 file upload is required');
            return;
        }
        if (!id && sourceType === 'youtube' && !podcastYoutubeUrlInput.value.trim()) {
            showPodcastAdminError('YouTube link is required');
            return;
        }

        podcastAdminSubmitBtn.disabled = true;
        try {
            const res = await fetch(id ? `${PODCASTS_API}/${id}` : PODCASTS_API, {
                method: id ? 'PUT' : 'POST',
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                showPodcastAdminError(data.message || 'Kuch ghalat ho gaya');
                return;
            }

            if (id) {
                const idx = podcastItems.findIndex((p) => p._id === id);
                if (idx !== -1) podcastItems[idx] = data.podcast;
            } else {
                podcastItems.unshift(data.podcast);
            }

            showPodcastAdminSuccess(data.message || 'Ho gaya!');
            renderPodcastAdminList();
            renderPodcastTabs();
            renderPodcastGrid();
            cancelPodcastEdit();
        } catch (err) {
            console.error(err);
            showPodcastAdminError('Could not connect to the server');
        } finally {
            podcastAdminSubmitBtn.disabled = false;
        }
    });
}

// ---------------- Delete ----------------
async function deletePodcast(id, row) {
    const ok = await window.showConfirm('Delete this content?', { confirmText: 'Delete' });
    if (!ok) return;
    try {
        const res = await fetch(`${PODCASTS_API}/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) {
            showPodcastAdminError(data.message || 'Could not delete');
            return;
        }
        podcastItems = podcastItems.filter((p) => p._id !== id);
        if (row) row.remove();
        renderPodcastTabs();
        renderPodcastGrid();
        if (podcastAdminEditId.value === id) cancelPodcastEdit();
    } catch (err) {
        console.error(err);
        showPodcastAdminError('Could not connect to the server');
    }
}

// ---------------- Init ----------------
setPodcastSourceType('youtube');
setPodcastProjectorEnabled(false);
