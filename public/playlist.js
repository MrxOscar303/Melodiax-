// ==========================================================================
// PLAYLIST FEATURE (Melodiax)
// - "Create Playlist" button se bara module khulta hai (name + optional
//   picture + tickbox se total songs select karna)
// - Playlists left sidebar me "Browse Podcasts" box ke neeche list hoti hain
//   (edit/delete icon ke saath, zyada hone par sirf usi hisse me scroll)
// - Navbar "Playlist" button (Premium ke bilkul baad) hamesha maujood rehta
//   hai - click karne par usi tab me songs sections chhup jaate hain aur
//   playlists grid dikhti hai. Home icon click karne se wapas normal view.
// - Kisi bhi playlist (sidebar item ya grid card) pe click karne se - play
//   button pe nahi - ek detail module khulta hai jisme us playlist ke sab
//   songs, aur har song kis date/time par playlist me add hua tha, dikhta hai.
// - Data localStorage me, per logged-in user (guest ke liye alag se) store
//   hota hai, is liye login/logout par playlist.js khud refresh ho jata hai.
// ==========================================================================
(function () {
    'use strict';

    // ---------------- Storage ----------------
    function getStorageKey() {
        const uid = (window.currentUser && window.currentUser._id) ? window.currentUser._id : 'guest';
        return 'melodiax_playlists_' + uid;
    }

    let playlists = [];
    let editingId = null;       // null => create mode, warna us playlist ki id (create/edit modal ke liye)
    let selectedCoverDataUrl = null;
    let detailPlaylistId = null; // is waqt detail module me kaunsi playlist khuli hai

    // Playlist shape: { id, name, image, createdAt, songs: [{ id, addedAt }] }
    function loadPlaylists() {
        try {
            const raw = localStorage.getItem(getStorageKey());
            let parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) parsed = [];
            // Purane format (songIds: [...]) ko naye format (songs: [{id, addedAt}]) me migrate karo
            parsed = parsed.map((pl) => {
                if (!pl.songs && Array.isArray(pl.songIds)) {
                    pl.songs = pl.songIds.map((id) => ({ id: String(id), addedAt: pl.createdAt || Date.now() }));
                    delete pl.songIds;
                }
                if (!Array.isArray(pl.songs)) pl.songs = [];
                return pl;
            });
            playlists = parsed;
        } catch (e) {
            playlists = [];
        }
    }

    function savePlaylists() {
        try {
            localStorage.setItem(getStorageKey(), JSON.stringify(playlists));
        } catch (e) {
            console.warn('Playlist failed to save:', e);
        }
    }

    // ---------------- Song catalog helpers ----------------
    // `songs` Script.js me top-level const hai (same document ke script tags
    // isko share karte hain), aur admin.js isi array me apne songs push karta
    // hai (trackId field ke sath) - is liye ye hamesha "total songs" (manual +
    // admin) ki up-to-date list hoti hai.
    function getSongsArray() {
        return (typeof songs !== 'undefined' && Array.isArray(songs)) ? songs : [];
    }

    function allSongsWithIds() {
        return getSongsArray().map((s, i) => ({
            id: String(s.trackId !== undefined ? s.trackId : i + 1),
            name: s.songName || 'Untitled',
            desc: s.songDes || '',
            image: s.songImage || ''
        }));
    }

    function getSongInfoById(id) {
        return allSongsWithIds().find((s) => s.id === String(id));
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function songCountLabel(n) {
        return n + (n === 1 ? ' song' : ' songs');
    }

    // Date + time dono ek readable English string me ("Aug 4, 2026, 10:32 AM")
    function formatAddedAt(ts) {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    }

    // ---------------- DOM refs ----------------
    const navPlaylistBtn = document.getElementById('nav-playlist-btn');
    const createPlaylistBtn = document.getElementById('create-playlist-btn');
    const sidebarList = document.getElementById('user-playlists-list');

    const modalOverlay = document.getElementById('playlist-modal-overlay');
    const modal = document.getElementById('playlist-modal');
    const modalTitle = document.getElementById('playlist-modal-title');
    const modalClose = document.getElementById('playlist-modal-close');
    const nameInput = document.getElementById('playlist-name-input');
    const coverUpload = document.getElementById('playlist-cover-upload');
    const coverInput = document.getElementById('playlist-cover-input');
    const coverPreview = document.getElementById('playlist-cover-preview');
    const coverDefault = document.getElementById('playlist-cover-default');
    const songPicker = document.getElementById('playlist-song-picker');
    const songSearchInput = document.getElementById('playlist-song-search');
    const songPickerEmpty = document.getElementById('playlist-song-picker-empty');
    const selectedCountEl = document.getElementById('playlist-selected-count');
    const errorEl = document.getElementById('playlist-modal-error');
    const saveBtn = document.getElementById('playlist-create-btn');
    const cancelBtn = document.getElementById('playlist-cancel-btn');

    const playlistsViewSection = document.getElementById('playlists-view-section');
    const playlistsViewGrid = document.getElementById('playlists-view-grid');
    const homeIcon = document.querySelector('.home-icon');

    const detailOverlay = document.getElementById('playlist-detail-overlay');
    const detailModal = document.getElementById('playlist-detail-modal');
    const detailClose = document.getElementById('playlist-detail-close');
    const detailCover = document.getElementById('playlist-detail-cover');
    const detailName = document.getElementById('playlist-detail-name');
    const detailCount = document.getElementById('playlist-detail-count');
    const detailEditBtn = document.getElementById('playlist-detail-edit-btn');
    const detailDeleteBtn = document.getElementById('playlist-detail-delete-btn');
    const detailSongList = document.getElementById('playlist-detail-song-list');

    // Zaroori markup missing ho (purana cached HTML wagera) to chup-chaap ruk jao
    if (!createPlaylistBtn || !modal || !sidebarList) return;

    // ---------------- Sidebar render ----------------
    function renderSidebar() {
        sidebarList.innerHTML = '';
        // Banner-click se auto-generate hui playlists (autoSection wali) yahan
        // "Your Library" sidebar me nahi dikhati - wo sirf Playlist tab ki grid
        // me create/dikhti hain.
        const visiblePlaylists = playlists.filter((pl) => !pl.autoSection);
        if (visiblePlaylists.length === 0) {
            sidebarList.innerHTML = '<p class="playlists-empty-hint">No playlists yet.</p>';
            return;
        }
        visiblePlaylists.forEach((pl) => {
            const item = document.createElement('div');
            item.className = 'sidebar-playlist-item';
            item.dataset.id = pl.id;
            item.innerHTML =
                '<div class="sidebar-playlist-cover">' +
                    (pl.image ? '<img src="' + pl.image + '" alt="">' : '<i class="fa-solid fa-music"></i>') +
                '</div>' +
                '<div class="sidebar-playlist-info">' +
                    '<strong>' + escapeHtml(pl.name) + '</strong>' +
                    '<span>' + songCountLabel(pl.songs.length) + '</span>' +
                '</div>' +
                '<div class="sidebar-playlist-actions">' +
                    '<button type="button" class="sidebar-playlist-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>' +
                    '<button type="button" class="sidebar-playlist-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>' +
                '</div>';

            item.querySelector('.sidebar-playlist-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(pl.id);
            });
            item.querySelector('.sidebar-playlist-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deletePlaylist(pl.id);
            });
            // Item pe click (edit/delete icon ke ilawa) = playlist detail (file) khol do
            item.addEventListener('click', () => openPlaylistDetail(pl.id));

            sidebarList.appendChild(item);
        });
    }

    // ---------------- Playlists tab-view (navbar "Playlist" button) ----------------
    function renderPlaylistsView() {
        if (!playlistsViewGrid) return;
        if (playlists.length === 0) {
            playlistsViewGrid.innerHTML = '<p class="playlists-empty-hint">You haven\'t created any playlists yet. Use "Create Playlist" on the left to make one.</p>';
            return;
        }
        playlistsViewGrid.innerHTML = '';
        playlists.forEach((pl) => {
            const card = document.createElement('div');
            card.className = 'playlist-view-card';
            card.dataset.id = pl.id;
            // Banner se auto-generate hui playlist (autoSection) ka naam section
            // se juda hota hai - usko manually edit karne ka koi matlab nahi,
            // is liye sirf Delete option dete hain.
            const actionsHtml = pl.autoSection
                ? '<button type="button" class="playlist-view-delete"><i class="fa-solid fa-trash"></i> Delete</button>'
                : '<button type="button" class="playlist-view-edit"><i class="fa-solid fa-pen"></i> Edit</button>' +
                  '<button type="button" class="playlist-view-delete"><i class="fa-solid fa-trash"></i> Delete</button>';
            card.innerHTML =
                '<div class="playlist-view-cover">' +
                    (pl.image ? '<img src="' + pl.image + '" alt="">' : '<i class="fa-solid fa-music"></i>') +
                    '<button type="button" class="playlist-view-play" title="Play"><i class="fa-solid fa-play"></i></button>' +
                '</div>' +
                '<div class="playlist-view-info">' +
                    '<div class="playlist-view-name">' + escapeHtml(pl.name) + '</div>' +
                    '<div class="playlist-view-count">' + songCountLabel(pl.songs.length) + '</div>' +
                '</div>' +
                '<div class="playlist-view-actions">' + actionsHtml + '</div>';

            const editBtn = card.querySelector('.playlist-view-edit');
            if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); openModal(pl.id); });
            card.querySelector('.playlist-view-delete').addEventListener('click', (e) => { e.stopPropagation(); deletePlaylist(pl.id); });
            card.querySelector('.playlist-view-play').addEventListener('click', (e) => { e.stopPropagation(); playPlaylist(pl); });
            // Card body pe click (play button ke ilawa) = playlist detail (file) khol do
            card.addEventListener('click', () => openPlaylistDetail(pl.id));

            playlistsViewGrid.appendChild(card);
        });
    }

    function playPlaylist(pl) {
        if (!pl.songs || !pl.songs.length) return;
        const el = document.getElementById(pl.songs[0].id);
        if (el) el.click(); // playMusic click handler (Script.js / admin.js) khud audio chala dega
    }

    // ---------------- Tab switching (navbar "Playlist" <-> normal home) ----------------
    // Smooth crossfade: the view that's leaving fades out first (opacity +
    // slight slide via .view-hidden), then the incoming view fades in.
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
        // Force a reflow so the browser registers the "hidden" state before
        // we remove it - otherwise the transition wouldn't play.
        if (elements[0]) void elements[0].offsetWidth;
        requestAnimationFrame(() => {
            elements.forEach((el) => { if (el) el.classList.remove('view-hidden'); });
        });
    }

    function showPlaylistsTab(afterShownCb) {
        const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
        // Playlists banner sirf home page ki cheez hai - Playlist tab me hide kar do.
        if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(false);
        // Download tab agar khula ho to usko bhi chupa do.
        if (typeof window.melodiaxHideDownloadsTab === 'function') window.melodiaxHideDownloadsTab();
        // About tab agar khula ho to usko bhi chupa do.
        if (typeof window.melodiaxHideAboutTab === 'function') window.melodiaxHideAboutTab();
        fadeOutThen(homeSections, () => {
            homeSections.forEach((sec) => { sec.style.display = 'none'; });
            renderPlaylistsView();
            if (playlistsViewSection) {
                playlistsViewSection.style.display = 'block';
                fadeIn([playlistsViewSection]);
            }
            if (typeof afterShownCb === 'function') afterShownCb();
        });
    }

    function showDefaultTab() {
        if (typeof window.melodiaxHideDownloadsTab === 'function') window.melodiaxHideDownloadsTab();
        fadeOutThen([playlistsViewSection], () => {
            if (playlistsViewSection) playlistsViewSection.style.display = 'none';
            const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
            homeSections.forEach((sec) => { sec.style.display = ''; });
            fadeIn(homeSections);
            // Home page pe wapas aate hi playlists banner dobara dikhao.
            if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(true);
        });
    }

    if (navPlaylistBtn) navPlaylistBtn.addEventListener('click', () => showPlaylistsTab());
    if (homeIcon) homeIcon.addEventListener('click', showDefaultTab);

    // ---------------- Auto-playlist from homepage banner click ----------------
    // Playlist-banner.js banner slide click par ye call karta hai: us section
    // (linkedSection) ke sab songs se ek playlist bana/update karo, uski cover
    // picture banner ki cover image ho, phir seedha Playlist tab khol kar wahi
    // playlist ka detail module bhi khol do.
    function upsertAutoPlaylist(sectionName, image, songIds) {
        if (!songIds || !songIds.length) return null;
        const now = Date.now();
        let pl = playlists.find((p) => p.autoSection && p.autoSection.toLowerCase() === sectionName.toLowerCase());
        if (pl) {
            const existingMap = new Map(pl.songs.map((s) => [s.id, s.addedAt]));
            pl.songs = songIds.map((id) => ({ id, addedAt: existingMap.has(id) ? existingMap.get(id) : now }));
            if (image) pl.image = image;
        } else {
            pl = {
                id: generateId(),
                name: sectionName,
                image: image || null,
                songs: songIds.map((id) => ({ id, addedAt: now })),
                createdAt: now,
                autoSection: sectionName
            };
            playlists.push(pl);
        }
        savePlaylists();
        renderSidebar();
        return pl.id;
    }

    window.melodiaxOpenSectionPlaylist = function (sectionName, image, songIds) {
        const id = upsertAutoPlaylist(sectionName, image, songIds);
        if (!id) return;
        // Homepage se kahin bhi switch nahi karte - seedha bara (80% screen)
        // detail module khol dete hain. Playlist khud Playlist tab ki grid me
        // (playlists array ke through) already create ho chuki hai.
        openPlaylistDetail(id, { large: true });
    };

    // ---------------- Playlist Detail module (songs + added date/time) ----------------
    function openPlaylistDetail(playlistId, opts) {
        const pl = playlists.find((p) => p.id === playlistId);
        if (!pl) return;
        detailPlaylistId = playlistId;

        detailModal.classList.toggle('playlist-detail-modal-large', !!(opts && opts.large));
        // Auto-generated (banner-linked) playlist ko manually edit karne ka
        // koi matlab nahi - is liye Edit button chupa dete hain, sirf Delete rehta hai.
        if (detailEditBtn) detailEditBtn.style.display = pl.autoSection ? 'none' : '';

        detailName.textContent = pl.name;
        detailCount.textContent = songCountLabel(pl.songs.length);
        detailCover.innerHTML = pl.image ? '<img src="' + pl.image + '" alt="">' : '<i class="fa-solid fa-music"></i>';

        if (pl.songs.length === 0) {
            detailSongList.innerHTML = '<p class="playlists-empty-hint">This playlist has no songs.</p>';
        } else {
            // Naye add hue songs sabse upar
            const sorted = [...pl.songs].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
            detailSongList.innerHTML = '';
            sorted.forEach((entry) => {
                const info = getSongInfoById(entry.id);
                const row = document.createElement('div');
                row.className = 'playlist-detail-song-row';
                row.innerHTML =
                    '<img src="' + (info ? info.image : '') + '" alt="">' +
                    '<div class="playlist-detail-song-info">' +
                        '<strong>' + escapeHtml(info ? info.name : 'Unknown song') + '</strong>' +
                        '<span>' + escapeHtml(info ? info.desc : '') + '</span>' +
                    '</div>' +
                    '<span class="playlist-detail-song-added"><i class="fa-solid fa-clock"></i>Added ' + formatAddedAt(entry.addedAt) + '</span>' +
                    '<button type="button" class="playlist-detail-song-play" title="Play"><i class="fa-solid fa-circle-play"></i></button>';

                row.querySelector('.playlist-detail-song-play').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const el = document.getElementById(entry.id);
                    if (el) el.click();
                });
                row.addEventListener('click', () => {
                    const el = document.getElementById(entry.id);
                    if (el) el.click();
                });

                detailSongList.appendChild(row);
            });
        }

        detailOverlay.classList.add('open');
        detailModal.classList.add('open');
    }

    function closePlaylistDetail() {
        detailOverlay.classList.remove('open');
        detailModal.classList.remove('open');
        detailModal.classList.remove('playlist-detail-modal-large');
        detailPlaylistId = null;
    }

    if (detailClose) detailClose.addEventListener('click', closePlaylistDetail);
    if (detailOverlay) detailOverlay.addEventListener('click', closePlaylistDetail);
    if (detailEditBtn) detailEditBtn.addEventListener('click', () => {
        const id = detailPlaylistId;
        closePlaylistDetail();
        openModal(id);
    });
    if (detailDeleteBtn) detailDeleteBtn.addEventListener('click', () => {
        const id = detailPlaylistId;
        closePlaylistDetail();
        deletePlaylist(id);
    });

    // ---------------- Modal: song picker (Create / Edit) ----------------
    function renderSongPicker(selectedIds) {
        const selectedSet = new Set(selectedIds);
        songPicker.innerHTML = '';
        allSongsWithIds().forEach((song) => {
            const row = document.createElement('label');
            row.className = 'playlist-song-row';
            // Search filter isi text (name + artist/desc, lowercase) ke against
            // match karta hai - 1000+ songs ke sath bhi bina re-render kiye
            // (checkbox state bilkul preserve rehti hai, sirf hide/show hota hai).
            row.dataset.searchText = (song.name + ' ' + song.desc).toLowerCase();
            row.innerHTML =
                '<input type="checkbox" class="playlist-song-checkbox" value="' + song.id + '" ' + (selectedSet.has(song.id) ? 'checked' : '') + '>' +
                '<img src="' + song.image + '" alt="">' +
                '<div class="playlist-song-row-info">' +
                    '<strong>' + escapeHtml(song.name) + '</strong>' +
                    '<span>' + escapeHtml(song.desc) + '</span>' +
                '</div>';
            row.querySelector('input').addEventListener('change', updateSelectedCount);
            songPicker.appendChild(row);
        });
        updateSelectedCount();
        filterSongPicker(''); // koi purana search term (pichli baar ka) apply na rahe
    }

    // Song name/artist se search - checked/unchecked state ko bilkul chhue
    // bina, sirf non-matching rows ko chupa deta hai (display:none). Ek
    // bara list (jaise 1000+ songs) mein bhi user ko turant sahi gaana
    // dhoondhne deta hai, scroll karte rehne ke bajaye.
    function filterSongPicker(term) {
        const q = term.trim().toLowerCase();
        let visibleCount = 0;
        songPicker.querySelectorAll('.playlist-song-row').forEach((row) => {
            const match = !q || row.dataset.searchText.includes(q);
            row.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        });
        if (songPickerEmpty) songPickerEmpty.style.display = visibleCount ? 'none' : '';
    }

    if (songSearchInput) {
        songSearchInput.addEventListener('input', () => filterSongPicker(songSearchInput.value));
    }

    function updateSelectedCount() {
        const count = songPicker.querySelectorAll('.playlist-song-checkbox:checked').length;
        if (selectedCountEl) selectedCountEl.textContent = count + ' selected';
    }

    function resetCoverUI() {
        selectedCoverDataUrl = null;
        if (coverPreview) { coverPreview.style.display = 'none'; coverPreview.src = ''; }
        if (coverDefault) coverDefault.style.display = 'flex';
        if (coverInput) coverInput.value = '';
    }

    function openModal(playlistId) {
        if (errorEl) errorEl.textContent = '';
        if (songSearchInput) songSearchInput.value = '';
        if (playlistId) {
            const pl = playlists.find((p) => p.id === playlistId);
            if (!pl) return;
            editingId = playlistId;
            modalTitle.innerHTML = '<i class="fa-solid fa-list-ul"></i> Edit Playlist';
            saveBtn.textContent = 'Save Changes';
            nameInput.value = pl.name;
            if (pl.image) {
                selectedCoverDataUrl = pl.image;
                coverPreview.src = pl.image;
                coverPreview.style.display = 'block';
                coverDefault.style.display = 'none';
            } else {
                resetCoverUI();
            }
            renderSongPicker(pl.songs.map((s) => s.id));
        } else {
            editingId = null;
            modalTitle.innerHTML = '<i class="fa-solid fa-list-ul"></i> Create Playlist';
            saveBtn.textContent = 'Create';
            nameInput.value = '';
            resetCoverUI();
            renderSongPicker([]);
        }
        modalOverlay.classList.add('open');
        modal.classList.add('open');
        nameInput.focus();
    }

    function closeModal() {
        modalOverlay.classList.remove('open');
        modal.classList.remove('open');
        editingId = null;
    }

    createPlaylistBtn.addEventListener('click', () => openModal(null));
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

    if (coverUpload) coverUpload.addEventListener('click', () => coverInput && coverInput.click());
    if (coverInput) coverInput.addEventListener('change', () => {
        const file = coverInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedCoverDataUrl = e.target.result;
            coverPreview.src = selectedCoverDataUrl;
            coverPreview.style.display = 'block';
            coverDefault.style.display = 'none';
        };
        reader.readAsDataURL(file);
    });

    function generateId() {
        return 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
            errorEl.textContent = 'Please enter a playlist name.';
            return;
        }
        const checkedIds = Array.from(songPicker.querySelectorAll('.playlist-song-checkbox:checked')).map((cb) => cb.value);
        if (checkedIds.length === 0) {
            errorEl.textContent = 'Please select at least one song.';
            return;
        }
        const now = Date.now();

        if (editingId) {
            const pl = playlists.find((p) => p.id === editingId);
            if (pl) {
                // Pehle se maujood songs ki original "added" date/time barkarar rakho,
                // sirf naye tick kiye hue songs ko abhi ka date/time milega.
                const existingMap = new Map(pl.songs.map((s) => [s.id, s.addedAt]));
                pl.name = name;
                pl.image = selectedCoverDataUrl;
                pl.songs = checkedIds.map((id) => ({ id, addedAt: existingMap.has(id) ? existingMap.get(id) : now }));
            }
        } else {
            playlists.push({
                id: generateId(),
                name: name,
                image: selectedCoverDataUrl,
                songs: checkedIds.map((id) => ({ id, addedAt: now })),
                createdAt: now
            });
        }

        savePlaylists();
        renderSidebar();
        if (playlistsViewSection && playlistsViewSection.style.display !== 'none') renderPlaylistsView();
        closeModal();
    });

    function deletePlaylist(id) {
        const pl = playlists.find((p) => p.id === id);
        if (!pl) return;
        showConfirm('Delete the playlist "' + pl.name + '"?').then((ok) => {
            if (!ok) return;
            playlists = playlists.filter((p) => p.id !== id);
            savePlaylists();
            renderSidebar();
            if (playlistsViewSection && playlistsViewSection.style.display !== 'none') renderPlaylistsView();
        });
    }

    // ---------------- Init (aur login/logout par user switch hone par re-init) ----------------
    function init() {
        loadPlaylists();
        renderSidebar();
        showDefaultTab();
    }

    window.addEventListener('melodiax-auth-changed', init);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
