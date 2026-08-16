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
    // 'Downloads' hamesha aakhir mein - kisi bhi category se collide na ho,
    // aur ye server data se nahi, IndexedDB (offline) se render hoti hai.
    const categories = ['All', ...getAllCategories(), 'Downloads'];
    podcastHubTabs.innerHTML = categories.map((cat) => `
        <button type="button" class="podcast-hub-tab${cat === podcastActiveCategory ? ' active' : ''}${cat === 'Downloads' ? ' podcast-hub-tab-downloads' : ''}" data-cat="${escapeHtml(cat)}">${cat === 'Downloads' ? '<i class="fa-solid fa-download"></i> ' : ''}${escapeHtml(cat)}</button>
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

// Cross-origin (Cloudinary) file ko fetch karke offline (IndexedDB) me save
// karta hai - bilkul mp3 songs ke offline-download pattern jaisa (device ke
// "Downloads" folder me file save NAHI hoti, sirf app ke andar offline
// available hoti hai). Login zaroori hai (guest kuch download nahi kar sakta).
async function handlePodcastDownloadClick(iconEl, id, meta) {
    if (!(window.currentUser && window.currentUser.id)) {
        if (typeof window.openModal === 'function') window.openModal('login');
        return;
    }
    if (!window.melodiaxOffline || !window.melodiaxOffline.podcasts) return;

    if (iconEl.classList.contains('downloaded')) {
        const ok = window.showConfirm
            ? await window.showConfirm('Remove this offline copy?', { confirmText: 'Remove' })
            : window.confirm('Remove this offline copy?');
        if (!ok) return;
        await window.melodiaxOffline.podcasts.delete(id);
        iconEl.classList.remove('downloaded');
        iconEl.title = 'Download';
        // Agar Downloads tab hi khula hai to list se turant hata do.
        if (podcastActiveCategory === 'Downloads') renderPodcastDownloadsGrid();
        return;
    }

    iconEl.classList.add('downloading');
    try {
        const res = await fetch(meta.url);
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        const blob = await res.blob();
        await window.melodiaxOffline.podcasts.save(id, blob, {
            title: meta.title,
            category: meta.category,
            image: meta.image,
            sourceType: meta.sourceType
        });
        iconEl.classList.remove('downloading');
        iconEl.classList.add('downloaded');
        iconEl.title = 'Downloaded - click to remove';
    } catch (err) {
        console.warn('Podcast offline download failed:', err);
        iconEl.classList.remove('downloading');
    }
}

function renderPodcastGrid() {
    if (podcastActiveCategory === 'Downloads') {
        renderPodcastDownloadsGrid();
        return;
    }
    // Search sirf upar wale dropdown (renderPodcastSearchSuggestions) mein
    // suggest hoti hai - ye neeche wala grid sirf category tab se filter
    // hota hai, taake ek hi cheez do jagah (dropdown + grid) na dikhe.
    const filtered = podcastItems.filter((p) => (
        podcastActiveCategory === 'All' || p.category === podcastActiveCategory
    ));

    if (!filtered.length) {
        podcastHubGrid.innerHTML = '';
        podcastHubEmpty.textContent = 'No content in this category yet.';
        podcastHubEmpty.style.display = 'block';
        return;
    }
    podcastHubEmpty.style.display = 'none';

    podcastHubGrid.innerHTML = filtered.map((p) => `
        <div class="podcast-hub-card" data-id="${p._id}">
            <div class="podcast-hub-card-thumb">
                <img src="${escapeHtml(podcastThumbnail(p))}" alt="">
                <div class="podcast-hub-card-play"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="podcast-hub-card-info">
                <span class="podcast-hub-card-cat">${escapeHtml(p.category)}</span>
                <h4>${escapeHtml(p.title)}</h4>
                ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
            </div>
        </div>
    `).join('');

    podcastHubGrid.querySelectorAll('.podcast-hub-card').forEach((card) => {
        card.addEventListener('click', () => {
            const p = podcastItems.find((item) => item._id === card.dataset.id);
            if (p) {
                setPodcastQueue(filtered, p);
                playPodcast(p);
            }
        });
    });
}

// ---------------- Downloads tab (offline-only, per-user) ----------------
async function renderPodcastDownloadsGrid() {
    if (!(window.currentUser && window.currentUser.id)) {
        podcastHubGrid.innerHTML = '';
        podcastHubEmpty.textContent = 'Log in to see your downloads.';
        podcastHubEmpty.style.display = 'block';
        return;
    }
    if (!window.melodiaxOffline || !window.melodiaxOffline.podcasts) return;
    const list = await window.melodiaxOffline.podcasts.listAll();

    if (!list.length) {
        podcastHubGrid.innerHTML = '';
        podcastHubEmpty.textContent = 'No downloads yet - tap the download icon on any Mp3/Mp4 episode.';
        podcastHubEmpty.style.display = 'block';
        return;
    }
    podcastHubEmpty.style.display = 'none';

    podcastHubGrid.innerHTML = list.map((r) => `
        <div class="podcast-hub-card" data-offline-id="${escapeHtml(r.id)}">
            <div class="podcast-hub-card-thumb">
                <img src="${escapeHtml(r.image || '/assets/default-song-cover.svg')}" alt="">
                <div class="podcast-hub-card-play"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="podcast-hub-card-info">
                <span class="podcast-hub-card-cat">${escapeHtml(r.category || '')}</span>
                <h4>${escapeHtml(r.title || 'Untitled')}</h4>
                <i class="fa-solid fa-trash podcast-hub-card-download downloaded" title="Remove download" data-remove-id="${escapeHtml(r.id)}"></i>
            </div>
        </div>
    `).join('');

    podcastHubGrid.querySelectorAll('[data-remove-id]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const ok = window.showConfirm
                ? await window.showConfirm('Remove this download?', { confirmText: 'Remove' })
                : window.confirm('Remove this download?');
            if (!ok) return;
            await window.melodiaxOffline.podcasts.delete(btn.dataset.removeId);
            renderPodcastDownloadsGrid();
        });
    });

    podcastHubGrid.querySelectorAll('.podcast-hub-card[data-offline-id]').forEach((card) => {
        card.addEventListener('click', () => {
            const rec = list.find((r) => r.id === card.dataset.offlineId);
            if (!rec) return;
            const item = {
                _id: rec.id,
                sourceType: rec.sourceType,
                audioFile: null, // playPodcast offline se hi resolve karega
                title: rec.title,
                category: rec.category,
                image: rec.image,
                projectorEnabled: false
            };
            const queueList = list.map((r) => ({
                _id: r.id, sourceType: r.sourceType, audioFile: null,
                title: r.title, category: r.category, image: r.image, projectorEnabled: false
            }));
            setPodcastQueue(queueList, item);
            playPodcast(item);
        });
    });
}

const podcastHubSearchResults = document.getElementById('podcast-hub-search-results');

if (podcastHubSearchInput) {
    podcastHubSearchInput.addEventListener('input', () => {
        podcastSearchTerm = podcastHubSearchInput.value;
        // Sirf dropdown suggestions update hoti hain - neeche wala grid
        // isse touch nahi hota (wo sirf category tabs se filter hota hai).
        renderPodcastSearchSuggestions();
    });
}

// Search bar ke bilkul niche chota dropdown - keyword type karte hi live
// suggestions (bilkul home page ke search jaisa).
function renderPodcastSearchSuggestions() {
    const term = podcastSearchTerm.trim().toLowerCase();
    if (!term) {
        podcastHubSearchResults.classList.remove('active');
        podcastHubSearchResults.innerHTML = '';
        return;
    }

    const matches = podcastItems.filter((p) =>
        (p.title && p.title.toLowerCase().includes(term))
        || (p.description && p.description.toLowerCase().includes(term))
        || (p.category && p.category.toLowerCase().includes(term))
    ).slice(0, 8);

    podcastHubSearchResults.classList.add('active');
    if (!matches.length) {
        podcastHubSearchResults.innerHTML = '<div class="podcast-hub-search-empty">No matches found</div>';
        return;
    }

    podcastHubSearchResults.innerHTML = matches.map((p) => `
        <div class="podcast-hub-search-item" data-id="${p._id}">
            <img src="${escapeHtml(podcastThumbnail(p))}" alt="">
            <div class="podcast-hub-search-item-info">
                <strong>${escapeHtml(p.title)}</strong>
                <span>${escapeHtml(p.category)}</span>
            </div>
        </div>
    `).join('');

    podcastHubSearchResults.querySelectorAll('.podcast-hub-search-item').forEach((item) => {
        item.addEventListener('click', () => {
            const p = podcastItems.find((entry) => entry._id === item.dataset.id);
            if (p) {
                // Search se play karne par queue = poori list (jaisi filter ho)
                // taake next/prev abhi bhi kaam kare.
                setPodcastQueue(podcastItems, p);
                playPodcast(p);
            }
            podcastHubSearchResults.classList.remove('active');
            podcastHubSearchInput.value = '';
            podcastSearchTerm = '';
        });
    });
}

document.addEventListener('click', (e) => {
    if (podcastHubSearchResults && podcastHubSearchInput
        && !podcastHubSearchInput.contains(e.target) && !podcastHubSearchResults.contains(e.target)) {
        podcastHubSearchResults.classList.remove('active');
    }
});

// ---------------- Playback queue (next/prev/auto-advance ke liye) ----------------
let podcastQueue = [];
let podcastQueueIndex = -1;

function setPodcastQueue(list, playedItem) {
    podcastQueue = list;
    podcastQueueIndex = list.findIndex((item) => item._id === playedItem._id);
}

// ============================================================
// ---------------- Playback ----------------
// Direct/synchronous (no `await` from a user-gesture click tak koi
// bhi audio.play()/playVideo() ke pehle) - warna iOS Safari/Chrome
// (WebKit) is call ko silently reject kar deta hai (button "pause"
// dikhata hai lekin kuch bajta nahi).
// ============================================================
async function playPodcast(p) {
    if (typeof makeAllPlay === 'function') makeAllPlay();

    // Songs aur Podcasts SAME <audio>/YouTube player share karte hain -
    // ye batata hai "abhi podcast chal raha hai" taake gaana khatam hone,
    // error aane, ya forward/backward/shuffle/repeat dabane par sahi
    // (podcast) system hi respond kare, kabhi galti se song system nahi.
    window.melodiaxAudioOwner = 'podcast';

    // Module band kar do taake user ko sirf neeche wala music player (aur
    // agar projector video hai to wo) dikhe - module khud disturb na kare.
    closePodcastHub();

    // ---------- Pehle audio + projector, dono ke liye offline copy check karo ----------
    // (Sirf mp3/mp4 - YouTube kabhi offline nahi hoti). Agar downloaded hai
    // to uski apni offline-saved projector video (agar thi) bhi milegi -
    // warna live/network wali dikhayenge (agar internet ho).
    let audioSrc = p.audioFile;
    let projectorSrc = p.projectorEnabled ? p.projectorVideo : '';
    if (p.sourceType !== 'youtube' && window.melodiaxOffline && window.melodiaxOffline.podcasts) {
        try {
            const offlineAudioUrl = await window.melodiaxOffline.podcasts.getPlayUrl(p._id);
            if (offlineAudioUrl) {
                audioSrc = offlineAudioUrl;
                const offlineProjectorUrl = await window.melodiaxOffline.podcasts.getProjectorUrl(p._id);
                if (offlineProjectorUrl) projectorSrc = offlineProjectorUrl;
            }
        } catch (err) { /* offline lookup fail - network path use karlo */ }
    }

    // ---------- Projector video (agar admin ne ON kiya ho, ya offline copy maujood ho) ----------
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

    if (projectorSrc && projectorVid && projectorContainer) {
        projectorVid.src = projectorSrc;
        projectorContainer.style.display = 'block';
        projectorVid.load();
        projectorVid.play().catch(() => {});
        if (mainRightPart) mainRightPart.classList.add('songs-fade-out');
        if (typeof showProjectorBtn === 'function') showProjectorBtn();
    }

    // ---------- Player-bar download icon (bilkul songs jaisa) ----------
    // Sirf mp3/mp4 podcasts download ho sakte hain (YouTube type kabhi nahi) -
    // isYoutube=true dene se button khud chup jayega un ke liye.
    if (typeof window.melodiaxUpdatePlayerDownloadBtn === 'function') {
        window.melodiaxUpdatePlayerDownloadBtn(p._id, p.sourceType === 'youtube', 'podcast');
    }
    // Player-bar se download click hone par offline.js ko pata hona chahiye
    // kis URL/meta se save karna hai (podcast cards ki tarah data-attributes
    // nahi hote yahan, is liye ek chhota global "stash" use karte hain).
    // Yahan hamesha ASAL (network) URLs stash karte hain - offline copy se
    // dobara offline copy banane ki koshish na ho.
    window.melodiaxCurrentPodcastMeta = {
        url: p.audioFile,
        title: p.title,
        category: p.category,
        image: podcastThumbnail(p),
        sourceType: p.sourceType,
        projectorVideo: p.projectorEnabled ? p.projectorVideo : ''
    };

    // ---------- Audio/YouTube ----------
    if (p.sourceType === 'youtube') {
        startYoutubeTrack({ youtubeId: p.youtubeId });
    } else {
        audio.src = audioSrc;
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

// Music-player ke shuffle/repeat button podcasts ke liye bhi wahi (shared)
// hain - unki current state seedha DOM se padh lete hain.
function playNextPodcast() {
    if (!podcastQueue.length || podcastQueueIndex === -1) return;

    if (typeof shuffle !== 'undefined' && shuffle && shuffle.classList.contains('active') && podcastQueue.length > 1) {
        let randIndex;
        do {
            randIndex = Math.floor(Math.random() * podcastQueue.length);
        } while (randIndex === podcastQueueIndex);
        podcastQueueIndex = randIndex;
        playPodcast(podcastQueue[podcastQueueIndex]);
        return;
    }

    if (podcastQueueIndex + 1 >= podcastQueue.length) {
        // Aage koi video nahi - kuch bhi play na ho, bas ruk jao.
        stopPodcastPlayback();
        return;
    }
    podcastQueueIndex++;
    playPodcast(podcastQueue[podcastQueueIndex]);
}

function playPrevPodcast() {
    if (!podcastQueue.length || podcastQueueIndex === -1) return;
    if (podcastQueueIndex - 1 < 0) return; // Pehla item hi hai - kuch na karo
    podcastQueueIndex--;
    playPodcast(podcastQueue[podcastQueueIndex]);
}

function podcastEnded() {
    if (typeof repeat !== 'undefined' && repeat && repeat.classList.contains('active')) {
        // Repeat: wahi video/audio dobara se
        const current = podcastQueue[podcastQueueIndex];
        if (current && current.sourceType === 'youtube') {
            if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.seekTo) {
                ytPlayer.seekTo(0, true);
                ytPlayer.playVideo();
            }
        } else {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
        const projectorVid = document.getElementById('projector-video');
        if (projectorVid && projectorVid.src) {
            projectorVid.currentTime = 0;
            projectorVid.play().catch(() => {});
        }
        return;
    }
    playNextPodcast();
}

function stopPodcastPlayback() {
    audio.pause();
    if (typeof ytPlayer !== 'undefined' && ytPlayer && ytPlayer.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch (err) { /* ignore */ }
    }
    const projectorVid = document.getElementById('projector-video');
    if (projectorVid) projectorVid.pause();
    play.classList.remove('fa-circle-pause');
    play.classList.add('fa-circle-play');
    if (typeof makeAllPlay === 'function') makeAllPlay();
}

window.melodiaxPlayNextPodcast = playNextPodcast;
window.melodiaxPlayPrevPodcast = playPrevPodcast;
window.melodiaxPodcastEnded = podcastEnded;

// Home page ke "Downloads" section (offline.js) se ek downloaded podcast
// play karne ke liye - poori downloaded-podcasts list ko hi queue bana dete
// hain, taake wahan se bhi next/prev/loop sab kaam karein.
window.melodiaxPlayOfflinePodcast = async function (rec) {
    if (!window.melodiaxOffline || !window.melodiaxOffline.podcasts) return;
    const allDownloaded = await window.melodiaxOffline.podcasts.listAll();
    const queueList = allDownloaded.map((r) => ({
        _id: r.id, sourceType: r.sourceType, audioFile: null,
        title: r.title, category: r.category, image: r.image, projectorEnabled: false
    }));
    const item = queueList.find((q) => q._id === rec.id) || {
        _id: rec.id, sourceType: rec.sourceType, audioFile: null,
        title: rec.title, category: rec.category, image: rec.image, projectorEnabled: false
    };
    setPodcastQueue(queueList, item);
    playPodcast(item);
};

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
    if (podcastHubSearchResults) podcastHubSearchResults.classList.remove('active');
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
    const counterEl = document.getElementById('podcast-admin-total-counter');
    if (counterEl) counterEl.textContent = podcastItems.length + (podcastItems.length === 1 ? ' podcast' : ' podcasts');
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

// Login/logout hone par Downloads tab ko refresh karo - taake dusre user ka
// login karte hi turant apni (nayi) downloads dikhein, purane user ki nahi.
window.addEventListener('melodiax-auth-changed', () => {
    if (podcastActiveCategory === 'Downloads' && podcastHubModal && podcastHubModal.classList.contains('open')) {
        renderPodcastDownloadsGrid();
    }
});
