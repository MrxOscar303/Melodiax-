// ============================================================

// Ye track karta hai ke user ne khud koi song click karke play ki hai ya
// nahi - agar nahi ki, to jab asal songs load ho jayein, now-bar (neeche
// wala mini-player) ko pehli asal (real) song se update kar dete hain,
// taake purani/local placeholder ki jagah hamesha sahi (Cloudinary wali)
// cover aur naam dikhe.
let userHasManuallyPlayed = false;

// ============================================================
// Admin panel (add songs via YouTube link) + unified playback
// ------------------------------------------------------------
// Admin/YouTube songs ab bilkul manual (Audio/*.mp3) songs jaisa
// hi kaam karte hain:
//   - Same card design, homepage ke usi "songs" grid me lagte hain
//     (4 songs per row/slot - 5th wala khud niche nayi row me).
//   - IDs manual songs ke aage se continue hote hain (104 ke baad
//     105, 106, ... - onscreen order ke mutabiq).
//   - Play/pause/next/prev/progress/volume/now-playing sab isi
//     neeche wale main player-bar (.now-bar + .music-controller)
//     se control hota hai - koi alag floating mini-player nahi.
//
// Note: Script.js is script tag se pehle load hota hai. Classic
// (non-module) <script> tags ek hi global scope share karte hain,
// isliye Script.js ke top-level `let`/`const`/function jaise
// `audio`, `songs`, `order`, `currentSong`, `play`, `progressBar`,
// `updateNowBar`, `handleProjector` waghera yahan bare naam se
// available aur (jahan zaroori ho) reassign-able hain.
// ============================================================

const SONGS_API = '/api/songs';

// ---------------- Elements ----------------
const adminPanel = document.getElementById('admin-panel');
const adminPanelOverlay = document.getElementById('admin-panel-overlay');
const adminPanelCloseBtn = document.getElementById('admin-panel-close');
const adminSongForm = document.getElementById('admin-song-form');
const adminFormError = document.getElementById('admin-form-error');
const adminFormSuccess = document.getElementById('admin-form-success');
const adminSongList = document.getElementById('admin-song-list');
const sectionDatalist = document.getElementById('song-section-list');

const songImageInput = document.getElementById('song-image');
const songImagePreview = document.getElementById('song-image-preview');

// ---------------- Song source (YouTube Link vs Mp3 Upload) ----------------
const songSourceTypeInput = document.getElementById('song-source-type');
const songSourceYesNo = document.getElementById('song-source-yesno');
const songYoutubeUrlField = document.getElementById('song-youtube-url-field');
const songYoutubeUrlInput = document.getElementById('song-youtube-url');
const songAudioFileField = document.getElementById('song-audio-file-field');
const songAudioFileInput = document.getElementById('song-audio-file');
const songAudioFileName = document.getElementById('song-audio-file-name');

function setSourceType(type) {
    songSourceTypeInput.value = type;
    if (songSourceYesNo) {
        songSourceYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.value === type);
        });
    }
    const isMp3 = type === 'mp3';
    if (songYoutubeUrlField) songYoutubeUrlField.style.display = isMp3 ? 'none' : '';
    if (songAudioFileField) songAudioFileField.style.display = isMp3 ? '' : 'none';
    if (!isMp3) {
        // Mp3 field chupa rahe hain - is se related file/label saaf kardo taake
        // baad me galti se purani file submit na ho jaye.
        if (songAudioFileInput) songAudioFileInput.value = '';
        if (songAudioFileName) songAudioFileName.textContent = '';
    }
}
if (songSourceYesNo) {
    songSourceYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
        btn.addEventListener('click', () => setSourceType(btn.dataset.value));
    });
}
if (songAudioFileInput) {
    songAudioFileInput.addEventListener('change', () => {
        const file = songAudioFileInput.files[0];
        if (songAudioFileName) songAudioFileName.textContent = file ? file.name : '';
    });
}

// ---------------- Projector video (optional yes/no feature) ----------------
const songProjectorEnabledInput = document.getElementById('song-projector-enabled');
const songProjectorYesNo = document.getElementById('song-projector-yesno');
const songProjectorVideoField = document.getElementById('song-projector-video-field');
const songProjectorVideoInput = document.getElementById('song-projector-video');
const songProjectorVideoPreview = document.getElementById('song-projector-video-preview');

function setProjectorEnabled(enabled) {
    songProjectorEnabledInput.value = enabled ? 'true' : 'false';
    if (songProjectorYesNo) {
        songProjectorYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
            btn.classList.toggle('active', (btn.dataset.value === 'yes') === enabled);
        });
    }
    if (songProjectorVideoField) songProjectorVideoField.style.display = enabled ? '' : 'none';
    if (!enabled) {
        songProjectorVideoInput.value = '';
        songProjectorVideoPreview.style.display = 'none';
        songProjectorVideoPreview.src = '';
    }
}
if (songProjectorYesNo) {
    songProjectorYesNo.querySelectorAll('.admin-yesno-btn').forEach((btn) => {
        btn.addEventListener('click', () => setProjectorEnabled(btn.dataset.value === 'yes'));
    });
}
if (songProjectorVideoInput) {
    songProjectorVideoInput.addEventListener('change', () => {
        const file = songProjectorVideoInput.files[0];
        if (file) {
            songProjectorVideoPreview.src = URL.createObjectURL(file);
            songProjectorVideoPreview.style.display = 'block';
        } else {
            songProjectorVideoPreview.style.display = 'none';
        }
    });
}

// ---------------- Panel open/close ----------------
if (document.getElementById('admin-panel-btn')) {
    document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
}
if (adminPanelCloseBtn) adminPanelCloseBtn.addEventListener('click', closeAdminPanel);
if (adminPanelOverlay) adminPanelOverlay.addEventListener('click', closeAdminPanel);

function openAdminPanel() {
    if (typeof cancelEdit === 'function') cancelEdit();
    populateSectionSuggestions();
    adminPanel.classList.add('open');
    adminPanelOverlay.classList.add('open');
}
function closeAdminPanel() {
    adminPanel.classList.remove('open');
    adminPanelOverlay.classList.remove('open');
}

// Existing <h2> section titles ko suggestions ke tor pe daal do
function populateSectionSuggestions() {
    const titles = new Set();
    document.querySelectorAll('.music-section > h2').forEach((h2) => titles.add(h2.textContent.trim()));
    sectionDatalist.innerHTML = Array.from(titles)
        .map((t) => `<option value="${escapeHtml(t)}"></option>`)
        .join('');
}

// ---------------- Image preview ----------------
if (songImageInput) {
    songImageInput.addEventListener('change', () => {
        const file = songImageInput.files[0];
        if (file) {
            songImagePreview.src = URL.createObjectURL(file);
            songImagePreview.style.display = 'block';
        } else {
            songImagePreview.style.display = 'none';
        }
    });
}

// ---------------- Helpers ----------------
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Backend ab har song ke liye `image` hamesha save karta hai - agar admin ne
// khud upload ki to uska path, warna YouTube ki default thumbnail ka URL
// (routes/songs.js dekhein). Ye function sirf bahut purani/legacy records ke
// liye fallback hai jinke pass image bilkul save nahi hui.
function songThumbnail(song) {
    if (song.image) return song.image;
    return `https://img.youtube.com/vi/${song.youtubeId}/maxresdefault.jpg`;
}
function songThumbnailFallback(song) {
    return `https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`;
}
// Kya ye thumbnail YouTube ki khud ki CDN se aa rahi hai (admin ki khud
// upload ki hui pic nahi)? Aise thumbnails me kabhi kabhi upar/neeche halki
// black bars hoti hain (khud tasveer ke andar bake hui), is liye inhe thora
// zoom karke crop karte hain taake card hamesha poori tarah fill rahe.
function isYoutubeCdnImage(song) {
    return !song.image || song.image.includes('img.youtube.com');
}
// <img> tag ke andar daalne wale src+onerror(+class) attributes - taake
// maxresdefault 404 hone par khud-b-khud hqdefault par chala jaye, aur
// object-fit:cover + zoom-crop ke sath thumbnail hamesha poori jagah fill
// kare, koi khaali/blank hissa na ho.
function thumbnailImgAttrs(song) {
    const src = songThumbnail(song);
    const cls = isYoutubeCdnImage(song) ? ' class="yt-thumb"' : '';
    if (!isYoutubeCdnImage(song)) return `src="${src}"${cls}`;
    return `src="${src}"${cls} onerror="this.onerror=null;this.src='${songThumbnailFallback(song)}';"`;
}

function showFormError(msg) {
    adminFormSuccess.classList.remove('visible');
    adminFormError.textContent = msg;
    adminFormError.classList.add('visible');
}
function showFormSuccess(msg) {
    adminFormError.classList.remove('visible');
    adminFormSuccess.textContent = msg;
    adminFormSuccess.classList.add('visible');
}

// ---------------- Sequential IDs (manual songs ke aage se continue) ----------------
// Page load par jitne bhi manual ".playMusic" icons maujood hain, unka sabse
// bara numeric id dhoondo (normally 104) - agla admin song usi ke +1 se shuru hoga.
function getNextTrackId() {
    let max = 0;
    document.querySelectorAll('.playMusic').forEach((el) => {
        const n = parseInt(el.id, 10);
        if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
}
let nextTrackId = getNextTrackId();

// ---------------- Rendering songs on the homepage (same layout as manual songs) ----------------
function getOrCreateSection(name) {
    const sections = document.querySelectorAll('.music-section');
    for (const section of sections) {
        const h2 = section.querySelector('h2');
        if (h2 && h2.textContent.trim().toLowerCase() === name.trim().toLowerCase()) {
            const existingContainer = section.querySelector('.songs');
            // Purana/malformed section jiske andar .songs div hi na ho - usme
            // dobara crash karne ke bajaye ek naya .songs div bana lo.
            if (existingContainer) return existingContainer;
            const fixedContainer = document.createElement('div');
            fixedContainer.className = 'songs';
            section.appendChild(fixedContainer);
            return fixedContainer;
        }
    }
    // Naya section banao, homepage ke aakhir mein (main-right-part ke andar).
    // Agar .main-right-part kisi wajah se (timing/DOM state) na mile to bhi
    // crash na ho - safe fallback container dhoondo ya khud bana lo.
    let mainRight = document.querySelector('.main-right-part');
    if (!mainRight) {
        console.warn('.main-right-part not found - using fallback container');
        mainRight = document.querySelector('main') || document.body;
    }
    const section = document.createElement('div');
    section.className = 'music-section';
    section.dataset.adminCreated = 'true'; // clearAdminTracks() ko batata hai ke ye original/static section nahi hai
    section.innerHTML = `<h2>${escapeHtml(name)}</h2><div class="songs"></div>`;
    mainRight.appendChild(section);
    return section.querySelector('.songs');
}

// Bilkul manual music-card jaisa hi markup (i#id.playMusic) - data-type/data-db-id
// sirf JS ke liye, koi alag visual/CSS nahi.
function buildSongCard(song, trackId) {
    const card = document.createElement('div');
    card.className = 'music-card';
    card.dataset.dbId = song._id; // clearAdminTracks() isi se in cards ko dhoondta hai
    const playbackType = song.sourceType === 'mp3' ? 'local' : 'youtube';
    card.innerHTML = `
        <div class="music-thumb-wrap"><img ${thumbnailImgAttrs(song)} alt=""></div>
        <div class="music-play-btn">
            <i id="${trackId}" class="playMusic fa-sharp fa-solid fa-circle-play" data-type="${playbackType}" data-db-id="${song._id}"></i>
        </div>
        <div class="img-title">${escapeHtml(song.title)}</div>
        <div class="img-description">${escapeHtml(song.description)}</div>
    `;
    return card;
}

// Naya song hamesha apni section ki list ke AAKHIR me lagta hai (niche/agli row
// me), taake pehle se maujood 4-song rows disturb na hon.
function renderSongOnHomepage(song, trackId) {
    const container = getOrCreateSection(song.section);
    if (!container) {
        console.warn('Could not render song on homepage (container not found), but it was saved:', song);
        return;
    }
    container.appendChild(buildSongCard(song, trackId));
}

function renderAdminListRow(song) {
    const row = document.createElement('div');
    row.className = 'admin-song-row';
    row.dataset.songId = song._id;
    row.innerHTML = `
        <img ${thumbnailImgAttrs(song)} alt="">
        <div class="admin-song-meta">
            <strong>${escapeHtml(song.title)}</strong>
            <span>${escapeHtml(song.section)}</span>
        </div>
        <div class="admin-song-actions">
            <button type="button" class="admin-song-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="admin-song-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    row.querySelector('.admin-song-edit').addEventListener('click', () => startEditSong(song));
    row.querySelector('.admin-song-delete').addEventListener('click', () => deleteSong(song._id, row));
    adminSongList.prepend(row);
}

// Row ke andar ka content refresh karo (title/section/thumbnail) bina row ko
// list mein idhar-udhar kiye - edit ke baad turant use hota hai.
function updateAdminListRow(song) {
    const row = adminSongList.querySelector(`.admin-song-row[data-song-id="${song._id}"]`);
    if (!row) return;
    row.querySelector('img').outerHTML = `<img ${thumbnailImgAttrs(song)} alt="">`;
    row.querySelector('.admin-song-meta strong').textContent = song.title;
    row.querySelector('.admin-song-meta span').textContent = song.section;
}

// Ek admin/YouTube song ko poori tarah "songs" (Script.js ka global track list)
// system me register karo - iske baad ye manual songs jaisa hi search, playlist
// modal aur main player-bar me kaam karega.
function registerTrack(song) {
    const trackId = nextTrackId++;
    const isMp3 = song.sourceType === 'mp3';
    songs.push({
        songName: song.title,
        songDes: song.description,
        songImage: songThumbnail(song),
        songSection: song.section,
        songYoutubeUrl: song.youtubeUrl,
        hasCustomImage: !!song.image,
        type: isMp3 ? 'local' : 'youtube',
        youtubeId: song.youtubeId,
        // Mp3-upload wale admin songs ke liye - ye field hi unifed local
        // playback (playTrackData/Script.js jaisa) ke liye audio source hai.
        songPath: isMp3 ? song.audioFile : '',
        dbId: song._id,
        trackId,
        // Projector background video - handleProjector() (Script.js) inhi do
        // fields (projector/videoPath) ko dekh kar video chalata hai, bilkul
        // manual songs jaisa hi.
        projector: !!song.projectorEnabled,
        videoPath: song.projectorVideo || '',
    });
    renderSongOnHomepage(song, trackId);
    return trackId;
}

// Edit ke baad homepage card ko (naye title/desc/thumbnail/section ke sath)
// dobara render karo - trackId (i# id) same rehta hai, is liye playback par
// koi asar nahi padta. Agar section badla hai to card khud-b-khud us naye
// section me chala jayega (zaroorat pade to naya section bhi ban jayega).
function updateSongOnHomepage(song, trackId) {
    const oldIcon = document.getElementById(String(trackId));
    if (oldIcon) {
        const oldCard = oldIcon.closest('.music-card');
        if (oldCard) oldCard.remove();
    }
    renderSongOnHomepage(song, trackId);
}

// ---------------- Fast reload + offline-correct homepage (admin/API songs) ----------------
// Pehle har refresh par admin-added songs sirf tab dikhti thin jab tak
// /api/songs ka poora network round-trip complete na ho jata - is liye
// "jaldi load nahi hoti" jaisa lagta tha. Ab last-fetched list localStorage
// me cache karke turant (network se pehle hi) dikha dete hain, phir background
// me fresh data se reconcile kar dete hain. Agar wo fresh fetch fail ho jaye
// (matlab hum offline hain), to cache se dikhaya hua admin content hata dete
// hain - taake offline mode me sirf original (static) sections/songs hi
// dikhein, koi aadhi-adhoori/na-chalne wali admin card nahi.
const SONGS_CACHE_KEY = 'melodiax-songs-cache';
let adminTrackIds = []; // is waqt homepage par render ho chuke admin/API tracks ke trackId

function loadSongsFromCache() {
    try {
        const raw = localStorage.getItem(SONGS_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
}

function saveSongsToCache(list) {
    try { localStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(list)); } catch (err) { /* quota/blocked - ignore */ }
}

// Pehle se render ho chuke sabhi admin/API tracks (cards + agar khaali reh
// jayein to unke liye khud banaye gaye sections) hata do, taake dobara
// render karne se pehle koi duplicate na bane, aur offline fallback ke liye
// bhi yahi istemal hota hai.
function clearAdminTracks() {
    if (adminTrackIds.length) {
        songs = songs.filter((s) => !adminTrackIds.includes(s.trackId));
        if (typeof order !== 'undefined' && Array.isArray(order)) {
            order = order.filter((s) => !adminTrackIds.includes(s.trackId));
        }
    }
    document.querySelectorAll('.music-card[data-db-id]').forEach((card) => card.remove());
    document.querySelectorAll('.music-section[data-admin-created="true"]').forEach((sec) => {
        if (!sec.querySelector('.music-card')) sec.remove();
    });
    if (adminSongList) adminSongList.innerHTML = '';
    adminTrackIds = [];
    nextTrackId = getNextTrackId();
}

function renderSongsList(list) {
    // API newest-first bhejta hai; hum oldest-first process karte hain taake
    // IDs (105, 106, ...) add hone ke order se hi assign hon.
    const ascending = list.slice().reverse();
    ascending.forEach((song) => {
        const trackId = registerTrack(song);
        adminTrackIds.push(trackId);
        renderAdminListRow(song);
    });
    // songs array me admin tracks add hone ke baad "order" ko refresh kardo
    // (agar abhi shuffle active nahi hai) taake next/prev/search sab in
    // naye tracks ko bhi dekh sakein.
    if (typeof songOnShuffle !== 'undefined' && !songOnShuffle) {
        order = [...songs];
    }
    // Agar user ne abhi tak khud koi song play nahi ki, to neeche wala
    // mini-player (now-bar) hamesha ek purani/broken local image dikhata
    // tha - ab pehli asal (real) song se update kar dete hain.
    if (!userHasManuallyPlayed && songs.length && nowBar) {
        const first = songs[0];
        nowBar.getElementsByTagName('img')[0].src = first.songImage;
        nowBar.getElementsByClassName('img-title-info')[0].innerText = first.songName;
        nowBar.getElementsByClassName('img-des-info')[0].innerText = first.songDes;
    }
}

async function loadAllSongs() {
    // 1. Cache se turant dikhado (agar pehle se koi ho) - refresh ke baad
    //    admin songs turant nazar aayengi, network ka intezar nahi karna hoga.
    const cached = loadSongsFromCache();
    if (cached && cached.length) {
        renderSongsList(cached);
    }

    // 2. Fresh/asli data network se lekar reconcile (verify) karo.
    try {
        const res = await fetch(SONGS_API);
        if (!res.ok) throw new Error('bad status: ' + res.status);
        const data = await res.json();
        const list = data.songs || [];
        saveSongsToCache(list);
        clearAdminTracks(); // cache se dikhaya hua purana render hata do
        renderSongsList(list); // fresh/confirmed data se dobara render karo
    } catch (err) {
        // Network fail hui (offline waghera). Agar humne cache se pehle hi
        // kuch dikha diya tha, use hata dete hain - jab tak fresh data verify
        // na ho jaye, sirf original (static) songs/sections hi dikhein.
        if (cached && cached.length) clearAdminTracks();
    }
}
loadAllSongs();

// ---------------- Edit mode ----------------
// null = "Add Song" mode. Kisi song ka _id = "Edit" mode (usi song ko update
// karenge, naya nahi banega).
let editingSongId = null;

const adminPanelTitle = document.getElementById('admin-panel-title');
const adminSubmitBtn = document.getElementById('admin-submit-btn');
const adminCancelEditBtn = document.getElementById('admin-cancel-edit');

function startEditSong(song) {
    editingSongId = song._id;
    setSourceType(song.sourceType === 'mp3' ? 'mp3' : 'youtube');
    document.getElementById('song-youtube-url').value = song.youtubeUrl || '';
    songAudioFileInput.value = '';
    songAudioFileName.textContent = song.sourceType === 'mp3' && song.audioFile
        ? 'Current file: ' + song.audioFile.split('/').pop() + ' (choose a new one to replace it)'
        : '';
    document.getElementById('song-title').value = song.title || '';
    document.getElementById('song-description').value = song.description || '';
    document.getElementById('song-section').value = song.section || '';
    songImageInput.value = '';
    if (song.image) {
        songImagePreview.src = song.image;
        songImagePreview.style.display = 'block';
    } else {
        songImagePreview.style.display = 'none';
    }

    setProjectorEnabled(!!song.projectorEnabled);
    songProjectorVideoInput.value = '';
    if (song.projectorEnabled && song.projectorVideo) {
        songProjectorVideoPreview.src = song.projectorVideo;
        songProjectorVideoPreview.style.display = 'block';
    } else {
        songProjectorVideoPreview.style.display = 'none';
    }

    adminPanelTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Song';
    adminSubmitBtn.textContent = 'Update Song';
    adminCancelEditBtn.style.display = 'inline-block';
    adminFormError.classList.remove('visible');
    adminFormSuccess.classList.remove('visible');

    populateSectionSuggestions();
    adminPanel.classList.add('open');
    adminPanelOverlay.classList.add('open');
    adminSongForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
    editingSongId = null;
    adminSongForm.reset();
    songImagePreview.style.display = 'none';
    setSourceType('youtube');
    setProjectorEnabled(false);
    adminPanelTitle.innerHTML = '<i class="fa-solid fa-music"></i> Add Song';
    adminSubmitBtn.textContent = 'Add Song';
    adminCancelEditBtn.style.display = 'none';
    adminFormError.classList.remove('visible');
    adminFormSuccess.classList.remove('visible');
}
if (adminCancelEditBtn) adminCancelEditBtn.addEventListener('click', cancelEdit);

// ---------------- Add / Edit song form submit ----------------
if (adminSongForm) {
    adminSongForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = adminSubmitBtn;
        submitBtn.disabled = true;
        adminFormError.classList.remove('visible');
        adminFormSuccess.classList.remove('visible');

        const isEditing = !!editingSongId;
        const sourceType = songSourceTypeInput.value === 'mp3' ? 'mp3' : 'youtube';

        // Basic client-side validation - taake galat/adhoora form server tak
        // jaane se pehle hi pakda jaye.
        if (sourceType === 'youtube' && !songYoutubeUrlInput.value.trim()) {
            showFormError('YouTube link is required');
            submitBtn.disabled = false;
            return;
        }
        if (sourceType === 'mp3' && !isEditing && !songAudioFileInput.files[0]) {
            showFormError('Mp3 file upload is required');
            submitBtn.disabled = false;
            return;
        }

        try {
            const formData = new FormData();
            formData.append('sourceType', sourceType);
            if (sourceType === 'youtube') {
                formData.append('youtubeUrl', songYoutubeUrlInput.value.trim());
            } else if (songAudioFileInput.files[0]) {
                formData.append('audio', songAudioFileInput.files[0]);
            }
            formData.append('title', document.getElementById('song-title').value.trim());
            formData.append('description', document.getElementById('song-description').value.trim());
            formData.append('section', document.getElementById('song-section').value.trim());
            if (songImageInput.files[0]) {
                formData.append('image', songImageInput.files[0]);
            }
            formData.append('projectorEnabled', songProjectorEnabledInput.value);
            if (songProjectorVideoInput.files[0]) {
                formData.append('projectorVideo', songProjectorVideoInput.files[0]);
            }

            const res = await fetch(isEditing ? `${SONGS_API}/${editingSongId}` : SONGS_API, {
                method: isEditing ? 'PUT' : 'POST',
                credentials: 'include',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                showFormError(data.message || (isEditing ? 'Could not update the song' : 'Could not add the song'));
                return;
            }

            if (isEditing) {
                showFormSuccess(data.message || 'Song updated successfully!');
                // songs[] array me matching entry update karo
                const idx = songs.findIndex((s) => s.dbId === data.song._id);
                if (idx !== -1) {
                    const isMp3 = data.song.sourceType === 'mp3';
                    songs[idx].songName = data.song.title;
                    songs[idx].songDes = data.song.description;
                    songs[idx].songImage = songThumbnail(data.song);
                    songs[idx].songSection = data.song.section;
                    songs[idx].songYoutubeUrl = data.song.youtubeUrl;
                    songs[idx].hasCustomImage = !!data.song.image;
                    songs[idx].type = isMp3 ? 'local' : 'youtube';
                    songs[idx].youtubeId = data.song.youtubeId;
                    songs[idx].songPath = isMp3 ? data.song.audioFile : '';
                    songs[idx].projector = !!data.song.projectorEnabled;
                    songs[idx].videoPath = data.song.projectorVideo || '';

                    const trackId = songs[idx].trackId;
                    updateSongOnHomepage(data.song, trackId);

                    // Agar yahi song abhi baj raha hai to now-bar bhi turant update karo
                    if (currentPlaybackType === 'youtube' && currentSong === trackId) {
                        nowBar.getElementsByTagName('img')[0].src = songs[idx].songImage;
                        nowBar.getElementsByClassName('img-title-info')[0].innerText = songs[idx].songName;
                        nowBar.getElementsByClassName('img-des-info')[0].innerText = songs[idx].songDes;
                        // Projector ON/OFF ya video khud badla ho to turant refresh karo
                        if (typeof handleProjector === 'function') handleProjector(trackId);
                    }
                }
                updateAdminListRow(data.song);
                cancelEdit();
            } else {
                showFormSuccess(data.message || 'Song added successfully!');
                registerTrack(data.song);
                renderAdminListRow(data.song);
                adminSongForm.reset();
                songImagePreview.style.display = 'none';
                setProjectorEnabled(false);
            }

            if (typeof songOnShuffle !== 'undefined' && !songOnShuffle) {
                order = [...songs];
            }
        } catch (err) {
            console.error((isEditing ? 'Edit' : 'Add') + ' song failed:', err);
            showFormError('Could not connect to the server. Is the backend running? [' + (err.message || err) + ']');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// ---------------- Delete song ----------------
async function deleteSong(id, row) {
    const ok = await showConfirm('Are you sure you want to delete this song?');
    if (!ok) return;
    try {
        const res = await fetch(`${SONGS_API}/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) return;
        row.remove();
        // Homepage se bhi matching card hata do
        const icon = document.querySelector(`.playMusic[data-db-id="${id}"]`);
        if (icon) {
            const removedId = parseInt(icon.id, 10);
            icon.closest('.music-card').remove();
            const idx = songs.findIndex((s) => s.dbId === id);
            if (idx !== -1) songs.splice(idx, 1);

            // Baaki sab songs jo removedId ke baad the, unke ".playMusic" icon
            // ids ko ek number neeche kar do - taake wo dobara `songs[id-1]`
            // ke through sahi entry par point karein (warna in sab songs ka
            // play permanently mismatch ho jata tha, isi liye "kabhi kabhi"
            // koi admin song chalta hi nahi tha).
            document.querySelectorAll('.playMusic').forEach((el) => {
                const n = parseInt(el.id, 10);
                if (!isNaN(n) && n > removedId) {
                    el.id = String(n - 1);
                }
            });
            nextTrackId = getNextTrackId();

            if (typeof songOnShuffle !== 'undefined' && !songOnShuffle) {
                order = [...songs];
            }
            // Agar yahi track abhi baj raha tha to player ko rok do
            if (currentPlaybackType === 'youtube' && currentSong === removedId) {
                if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
                stopYtProgressPolling();
                currentPlaybackType = 'local';
                play.classList.remove('fa-circle-pause');
                play.classList.add('fa-circle-play');
            }
        }
    } catch (err) {
        // ignore
    }
}

// ============================================================
// UNIFIED PLAYBACK ENGINE
// Manual (.mp3) tracks pehle jaisa hi Script.js ke through bajte
// hain. YouTube tracks isi neeche wale player-bar (now-bar +
// music-controller) se, hidden YouTube IFrame player ke zariye.
// ============================================================

let ytPlayer = null;
let ytPlayerReady = false;
let ytProgressInterval = null;
let currentPlaybackType = 'local'; // 'local' | 'youtube'
let pendingYoutubeId = null;
let currentYoutubeId = null; // abhi kaunsa YouTube video load/buffer ho chuka hai
let pendingYoutubeTimeout = null;

// YouTube API isko khud call karta hai jab script load ho jata hai (global function honi zaroori hai)
window.onYouTubeIframeAPIReady = function () {
    // Index.html mein container div 1x1px (bilkul chhota) hai - JS se hi
    // thoda barha dete hain (2x2px) taake purane iOS/WebKit (jaise iPhone 7)
    // bilkul 0x0 (zero-size) video ko block na kare (muted hone ke bawajood
    // bhi kar deta hai). Div ab bhi opacity:0 + off-screen hone ki wajah se
    // poori tarah invisible rahega - koi visual/layout farak nahi padega.
    const ytContainer = document.getElementById('yt-player-hidden');
    if (ytContainer) {
        ytContainer.style.width = '2px';
        ytContainer.style.height = '2px';
    }

    ytPlayer = new YT.Player('yt-player-hidden', {
        height: '2',
        width: '2',
        playerVars: {
            // iOS Safari/Chrome (WebKit) is param ke bagair video ko forced
            // full-screen mein khol deta hai - hum audio-jaisa hidden inline
            // playback chahte hain, is liye ye zaroori hai.
            playsinline: 1,
        },
        events: {
            onReady: () => {
                ytPlayerReady = true;
                if (pendingYoutubeId) {
                    const idToPlay = pendingYoutubeId;
                    pendingYoutubeId = null;
                    clearTimeout(pendingYoutubeTimeout);
                    // Guard: is dauran user kahin aur (local song) chala chuka
                    // ho sakta hai - sirf tab play karo jab wo abhi bhi
                    // YouTube track hi sunna chahta ho.
                    if (currentPlaybackType === 'youtube' && currentYoutubeId === idToPlay) {
                        // iOS par "unmuted autoplay" (bina kisi turant tap ke)
                        // block ho jata hai - muted start hamesha allowed
                        // hoti hai, PLAYING state milte hi (onYtStateChange
                        // mein) khud unmute ho jayega.
                        if (ytPlayer.mute) ytPlayer.mute();
                        ytPlayer.loadVideoById(idToPlay);
                        ytPlayer.playVideo();
                        // Ye call ab user ke asal tap se kaafi der baad (YT
                        // iframe API load hone ke baad) ho rahi hai - iOS is
                        // "der se aayi" playVideo() request ko silently block
                        // kar sakta hai (koi error nahi, bas kabhi PLAYING
                        // state par nahi jata). Verify karke UI ko honest rakho.
                        verifyYtPlaybackStarted(idToPlay);
                    }
                }
            },
            onStateChange: onYtStateChange,
            onError: onYtError,
        },
    });
};

// playVideo() call karne ke thodi der baad check karo ke player asal mein
// PLAYING state mein gaya ya nahi. iOS par kabhi kabhi (khaas kar jab
// playVideo() user ke turant tap ke bagair, baad mein/async call hoti hai)
// ye silently block ho jata hai - koi onError bhi nahi aata, bas state
// hamesha "cued/buffering" par atka reh jata hai. Aisa ho to UI ko turant
// "play" par wapas reset kar do (warna "pause" icon hamesha ke liye ghalat
// dikhata rahega) aur user ko console mein wajah bata do.
function verifyYtPlaybackStarted(expectedId) {
    setTimeout(() => {
        if (currentPlaybackType !== 'youtube' || currentYoutubeId !== expectedId) return;
        if (!ytPlayer || !ytPlayer.getPlayerState) return;
        const state = ytPlayer.getPlayerState();
        if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
            console.warn('YouTube playback did not start (blocked by browser) - resetting UI. Try tapping play again.');
            play.classList.remove('fa-circle-pause');
            play.classList.add('fa-circle-play');
            makeAllPlay();
            stopYtProgressPolling();
        }
    }, 1800);
}

function onYtError(event) {
    // 2/100/101/150 = embedding disallowed/blocked/video removed - is video ko
    // bajaya hi nahi ja sakta chahe link sahi ho. Pehle ye chup-chaap fail ho
    // kar "kuch nahi hota" jaisa lagta tha - ab UI reset karke agla song try karte hain.
    console.error('YouTube player error, code:', event.data);
    stopYtProgressPolling();
    play.classList.remove('fa-circle-pause');
    play.classList.add('fa-circle-play');
    if (typeof playNextSong === 'function') playNextSong();
}

// Agar 8 second ke andar YouTube IFrame API load/ready hi nahi hoti (ad-blocker,
// browser extension, ya network hi youtube.com block kar raha ho), to pehle
// koi bhi YouTube song hamesha "chup-chaap kuch nahi hota" jaisa lagta tha -
// ab kam az kam console me wajah saaf batayi jayegi.
setTimeout(() => {
    if (!ytPlayerReady) {
        console.error(
            'YouTube player was still not ready after 8 seconds. If YouTube songs are not playing at all, this could be because: ' +
            '(1) an ad-blocker/extension is blocking youtube.com, (2) the network/firewall is not allowing access to youtube.com, ' +
            'or (3) "https://www.youtube.com/iframe_api" itself could not load - check the Network tab.'
        );
    }
}, 8000);

function onYtStateChange(event) {
    if (currentPlaybackType !== 'youtube') return;
    if (event.data === YT.PlayerState.PLAYING) {
        play.classList.remove('fa-circle-play');
        play.classList.add('fa-circle-pause');
        startYtProgressPolling();
        // iOS par muted state me hi playback allow hoti hai (autoplay-with-
        // sound block ho jata hai) - is liye humne mute karke play() call
        // kiya tha (neeche startYoutubeTrack me). Ab jab video WAKAI PLAYING
        // ho chuka hai (ye guaranteed callback hai), turant unmute kar do aur
        // user ka pehle se chuna hua volume wapas laga do. Ye ek chalte hue
        // video ko unmute karna hai, naya (blocked) autoplay-with-sound nahi
        // - is liye iOS ye allow karta hai.
        if (ytPlayer && ytPlayer.unMute) {
            ytPlayer.unMute();
            if (ytPlayer.setVolume && volumeBar) ytPlayer.setVolume(volumeBar.value);
        }
    } else if (event.data === YT.PlayerState.PAUSED) {
        play.classList.remove('fa-circle-pause');
        play.classList.add('fa-circle-play');
        stopYtProgressPolling();
    } else if (event.data === YT.PlayerState.ENDED) {
        stopYtProgressPolling();
        if (typeof songOnRepeat !== 'undefined' && songOnRepeat) {
            ytPlayer.seekTo(0);
            ytPlayer.playVideo();
            if (projectorVid && projectorVid.src !== '') {
                projectorVid.currentTime = 0;
                projectorVid.play();
            }
        } else {
            playNextSong();
            if (typeof handleProjector === 'function') handleProjector(currentSong);
        }
    }
}

function startYtProgressPolling() {
    stopYtProgressPolling();
    ytProgressInterval = setInterval(() => {
        if (!ytPlayer || !ytPlayer.getDuration) return;
        const duration = ytPlayer.getDuration();
        const current = ytPlayer.getCurrentTime();
        if (!duration) return;
        setProgressFill((current / duration) * 100);
        const currentEl = document.getElementById('track-current');
        const totalEl = document.getElementById('track-total');
        if (currentEl) currentEl.innerText = formatTime(current);
        if (totalEl) totalEl.innerText = formatTime(duration);

        // Projector video ko YouTube audio ke sath sync rakho (bilkul local
        // audio.timeupdate wale drift-check jaisa hi, 0.5s se zyada drift ho to hi seek karo).
        // Video gaane se chhoti ho sakti hai aur loop ho rahi hoti hai, is liye
        // drift bhi usi ki duration se modulo lekar nikalte hain.
        if (projectorVid && projectorVid.src !== '' && !projectorVid.paused) {
            const vidDur = projectorVid.duration;
            const expected = (vidDur && isFinite(vidDur) && vidDur > 0) ? current % vidDur : current;
            if (Math.abs(projectorVid.currentTime - expected) > 0.5) {
                syncProjectorToTime(current);
            }
        }
    }, 500);
}
function stopYtProgressPolling() {
    if (ytProgressInterval) clearInterval(ytProgressInterval);
    ytProgressInterval = null;
}

// Local audio jab bhi bajna shuru ho (chahe manual click ho, forward/backward
// ho ya repeat/ended loop), YouTube ko turant pause kardo - taake do cheezein
// ek sath na bajen.
audio.addEventListener('play', () => {
    if (currentPlaybackType === 'youtube' && ytPlayer && ytPlayer.pauseVideo) {
        ytPlayer.pauseVideo();
        stopYtProgressPolling();
    }
    currentPlaybackType = 'local';
});

function startYoutubeTrack(data) {
    currentPlaybackType = 'youtube';
    if (!audio.paused) audio.pause();
    if (ytPlayerReady && ytPlayer && ytPlayer.loadVideoById) {
        // iOS par direct tap ke bawajood "unmuted autoplay" kabhi kabhi block
        // ho jata hai (YouTube apni khud ki autoplay policy bhi lagata hai) -
        // muted start hamesha allowed hoti hai; onYtStateChange PLAYING milte
        // hi khud unmute kar dega.
        if (ytPlayer.mute) ytPlayer.mute();
        if (currentYoutubeId === data.youtubeId && ytPlayer.seekTo) {
            // Wahi song dobara click hua - naya network fetch karne ki
            // zaroorat nahi, bas shuru se dobara chala do (turant hota hai).
            ytPlayer.seekTo(0, true);
            ytPlayer.playVideo();
        } else {
            currentYoutubeId = data.youtubeId;
            ytPlayer.loadVideoById(data.youtubeId);
            ytPlayer.playVideo();
        }
        verifyYtPlaybackStarted(data.youtubeId);
    } else {
        pendingYoutubeId = data.youtubeId;
        currentYoutubeId = data.youtubeId;
        // YT player abhi tak ready nahi hua. Pehle is case me user "pause"
        // (playing) icon dekhta rehta tha lekin awaaz kabhi start hi nahi
        // hoti thi agar YT iframe API load na ho paye (ad-blocker/slow
        // network/blocked). Ab 5 second wait karke, agar ab bhi ready na ho,
        // UI reset karke agla gaana try kar lete hain - taake user ko pata
        // chale ke ye gaana nahi chal saka, chup-chaap atka na rahe.
        clearTimeout(pendingYoutubeTimeout);
        pendingYoutubeTimeout = setTimeout(() => {
            if (pendingYoutubeId === data.youtubeId && !ytPlayerReady) {
                console.error('YouTube player failed to load (5s timeout) - trying the next song.');
                pendingYoutubeId = null;
                onYtError({ data: -1 });
            }
        }, 5000);
    }
    play.classList.remove('fa-circle-play');
    play.classList.add('fa-circle-pause');
}

// makeAllPlay() (Script.js) ne playMusic icons ek dafa hi capture kiye the -
// isko fresh query karne wale version se replace karo taake baad me add hue
// (admin) icons bhi hamesha sahi reset hon.
makeAllPlay = () => {
    document.querySelectorAll('.playMusic').forEach((el) => {
        el.classList.remove('fa-circle-pause');
        el.classList.add('fa-circle-play');
    });
};

// playNextSong/playPrevSong (Script.js) 104 hardcoded the aur sirf songPath
// jaante the - dono ko dynamic total + local/youtube dono types support karne
// wale version se replace karo (forward/backward/ended sab isi naam se call
// karte hain, is liye overwrite karna kaafi hai).
playNextSong = () => {
    const total = songs.length;
    if (!total) return;
    if (!songOnRepeat) {
        let nextSong = (currentSong + 1) % total;
        currentSong = nextSong === 0 ? total : nextSong;
    }
    playTrackData(order[currentSong - 1] || songs[currentSong - 1]);
};

playPrevSong = () => {
    const total = songs.length;
    if (!total) return;
    let prevSong = currentSong - 1;
    currentSong = prevSong === 0 ? total : prevSong;
    playTrackData(order[currentSong - 1] || songs[currentSong - 1]);
};

function playTrackData(data) {
    if (!data) return;
    if (data.type === 'youtube') {
        startYoutubeTrack(data);
    } else {
        // Mobile browsers (khaas kar iOS - Safari aur Chrome dono, kyunki
        // dono WebKit use karte hain) audio.play() ko sirf turant/sync tarah
        // allow karte hain - "await" beech me aane se silently block ho jata
        // hai. Isliye pehle turant network src se play karo.
        const playForId = currentSong;
        audio.src = data.songPath;
        audio.currentTime = 0;
        audio.play().catch(err => console.warn('Play blocked:', err));

        // Offline (IndexedDB) copy baad me (async) check karo - mil jaye to
        // usi gaane par silently switch kardo (ab user-gesture zaroori nahi,
        // audio pehle se play ho chuka hota hai).
        if (window.melodiaxOffline && typeof window.melodiaxOffline.getPlayUrl === 'function') {
            window.melodiaxOffline.getPlayUrl(playForId).then((offlineUrl) => {
                if (offlineUrl && currentSong === playForId) {
                    const resumeAt = audio.currentTime;
                    audio.src = offlineUrl;
                    audio.currentTime = resumeAt;
                    audio.play().catch(() => {});
                }
            }).catch(() => { /* offline lookup fail - network path already chal raha hai */ });
        }
    }
    // `data` yahan already maujood hai (jis track ko chalaya ja raha hai) -
    // seedha wahi pass kardo taake `order[currentSong-1]` par depend na karna
    // pade (jo offline/edge cases me is track ko na bhi rakhta ho).
    updateNowBar(data);
    if (typeof window.melodiaxUpdatePlayerDownloadBtn === 'function') window.melodiaxUpdatePlayerDownloadBtn(currentSong, data.type === 'youtube');
}

// Admin card (YouTube ya khud-upload ki hui Mp3) ke play icon par click -
// manual icons already Script.js ke apne (per-element) listeners se chal rahe
// hain, unhe yahan double-handle nahi karte. data-db-id sirf admin-added
// tracks par hota hai (chahe type youtube ho ya local/mp3) - isi se manual
// songs se differentiate karte hain.
document.addEventListener('click', (e) => {
    const icon = e.target.closest('.playMusic');
    if (!icon || !icon.dataset.dbId) return;
    if (icon.dataset.type !== 'youtube' && icon.dataset.type !== 'local') return;

    userHasManuallyPlayed = true;

    const id = parseInt(icon.id, 10);
    const data = songs[id - 1];
    if (!data) return;

    currentSong = id;
    makeAllPlay();
    icon.classList.remove('fa-circle-play');
    icon.classList.add('fa-circle-pause');

    if (typeof handleProjector === 'function') handleProjector(id);

    if (data.type === 'youtube') {
        startYoutubeTrack(data);
    } else {
        // Admin-uploaded Mp3 - bilkul manual songs jaisa hi local <audio>
        // playback. Mobile (khaas kar iOS) par audio.play() sirf click ke
        // andar TURANT/sync call hone par allow hota hai - isliye pehle
        // turant network src se play karo, offline (IndexedDB) copy check
        // baad me (async) karo.
        audio.src = data.songPath;
        audio.currentTime = 0;
        audio.play().catch(err => console.warn('Play blocked:', err));
        // Bara (main) play/pause button bhi turant "pause" dikhaye - warna
        // audio bajta rehta tha lekin button "play" hi dikhata reh jata tha.
        play.classList.remove('fa-circle-play');
        play.classList.add('fa-circle-pause');

        if (window.melodiaxOffline && typeof window.melodiaxOffline.getPlayUrl === 'function') {
            window.melodiaxOffline.getPlayUrl(id).then((offlineUrl) => {
                if (offlineUrl && currentSong === id) {
                    const resumeAt = audio.currentTime;
                    audio.src = offlineUrl;
                    audio.currentTime = resumeAt;
                    audio.play().catch(() => {});
                }
            }).catch(() => { /* offline lookup fail - network path already chal raha hai */ });
        }
    }

    // now-bar (bottom-left) update - seedha clicked track se, order/shuffle se
    // independent, taake hamesha sahi title/desc/image dikhe.
    nowBar.getElementsByTagName('img')[0].src = data.songImage;
    nowBar.getElementsByClassName('img-title-info')[0].innerText = data.songName;
    nowBar.getElementsByClassName('img-des-info')[0].innerText = data.songDes;
    if (typeof window.melodiaxUpdatePlayerDownloadBtn === 'function') window.melodiaxUpdatePlayerDownloadBtn(id, data.type === 'youtube');
});

// ---------------- Unified play/pause button (main player-bar) ----------------
// Script.js ka pehle se bana listener sirf local audio jaanta hai - node
// clone+replace karke uska listener hata dete hain aur ek naya unified
// listener lagate hain jo local/youtube dono handle kare.
(function setupUnifiedPlayButton() {
    const oldBtn = document.getElementById('play');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    play = newBtn; // Script.js ka `let play` reassign - baaki sab isi naam se refer karte hain

    play.addEventListener('click', () => {
        const projectorContainer = document.getElementById('projector-overlay');
        const mainRightPart = document.querySelector('.main-right-part');

        if (currentPlaybackType === 'youtube') {
            if (!ytPlayer) return;
            const ytSongData = songs[currentSong - 1];
            const state = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
            if (state === YT.PlayerState.PLAYING) {
                ytPlayer.pauseVideo();
                play.classList.remove('fa-circle-pause');
                play.classList.add('fa-circle-play');
                if (projectorVid) {
                    projectorVid.pause();
                    if (mainRightPart) mainRightPart.classList.remove('songs-fade-out');
                    hideProjectorBtn();
                }
            } else {
                ytPlayer.playVideo();
                play.classList.remove('fa-circle-play');
                play.classList.add('fa-circle-pause');
                if (projectorVid && projectorVid.src !== '' && ytSongData && ytSongData.projector) {
                    showProjectorBtn();
                    if (!projectorExited) {
                        projectorVid.play();
                        if (mainRightPart) {
                            projectorContainer.style.display = 'block';
                            mainRightPart.classList.add('songs-fade-out');
                        }
                    }
                }
            }
            return;
        }

        // Local (bilkul Script.js wala pehla logic)
        const songData = songs[currentSong - 1];
        if (audio.paused || audio.currentTime <= 0) {
            audio.play();
            play.classList.remove('fa-circle-play');
            play.classList.add('fa-circle-pause');
            if (projectorVid && projectorVid.src !== "" && songData && songData.projector) {
                showProjectorBtn();
                if (!projectorExited) {
                    projectorVid.play();
                    if (mainRightPart) {
                        projectorContainer.style.display = "block";
                        mainRightPart.classList.add('songs-fade-out');
                    }
                }
            }
        } else {
            audio.pause();
            play.classList.add('fa-circle-play');
            play.classList.remove('fa-circle-pause');
            if (projectorVid) {
                projectorVid.pause();
                if (mainRightPart) mainRightPart.classList.remove('songs-fade-out');
                hideProjectorBtn();
            }
        }
    });
})();

// ---------------- Unified progress bar (seek) ----------------
(function setupUnifiedProgressBar() {
    const oldBar = document.getElementById('progressBar');
    const newBar = oldBar.cloneNode(true);
    oldBar.parentNode.replaceChild(newBar, oldBar);
    progressBar = newBar; // Script.js ka `let progressBar` reassign

    progressBar.addEventListener('input', function () {
        const value = this.value;
        setProgressFill(value);

        if (currentPlaybackType === 'youtube') {
            if (ytPlayer && ytPlayer.getDuration) {
                const duration = ytPlayer.getDuration();
                if (duration) {
                    const seekTime = (value / 100) * duration;
                    ytPlayer.seekTo(seekTime, true);
                    if (projectorVid && projectorVid.src !== '') {
                        syncProjectorToTime(seekTime);
                    }
                }
            }
        } else {
            audio.currentTime = (value * audio.duration) / 100;
            if (projectorVid && projectorVid.src !== "") {
                syncProjectorToTime(audio.currentTime);
            }
        }
    });
})();

// ---------------- Volume (local audio ke sath sath YouTube player ko bhi sync) ----------------
volumeBar.addEventListener('input', (e) => {
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(e.target.value);
});
volIcon.addEventListener('click', () => {
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(volumeBar.value);
});


