// ==========================================================================
// OFFLINE DOWNLOADS (Melodiax)
// - Har local/manual song (".playMusic" jinke data-type="youtube" nahi hai)
//   ke music-card par ek chhota download button dikhta hai.
// - Click karne par us gaane ki audio file fetch karke IndexedDB me ek Blob
//   ke tor par save ho jati hai - phir wo gaana bina internet ke bhi chal
//   sakta hai (Script.js/admin.js pehle IndexedDB check karte hain, tabhi
//   network path use karte hain).
// - YouTube-type (admin) tracks download nahi ho sakte - unko stream karne
//   ke liye hamesha internet chahiye hota hai, is liye unpar button nahi lagta.
// - Downloads PER LOGGED-IN USER alag rehti hain (playlist.js jaisa hi
//   pattern): har account ki apni IndexedDB database hoti hai, is liye ek
//   hi device/browser par do alag accounts login karein to unki offline
//   downloads kabhi aapas me mix nahi hoti. Login/logout hote hi
//   ('melodiax-auth-changed' event) khud sahi user ki list par switch ho
//   jata hai.
// ==========================================================================
(function () {
    'use strict';

    if (!('indexedDB' in window)) return; // bohot purana browser - chup-chaap skip

    const DB_VERSION = 1;
    const STORE = 'songs';

    // Currently-playing gaane ka naam/image/desc capture karne ke liye - ye
    // hamesha now-bar se lete hain (home-card dhoondne ke bajaye), kyunki
    // now-bar hamesha sahi/current data dikha raha hota hai chahe gaana
    // kahin se bhi (home card, search, admin/YouTube track, ya downloads tab
    // se dobara) chalaya gaya ho, chahe uska apna DOM card mojood ho ya nahi.
    const nowBarEl = document.querySelector('.now-bar');
    function getNowBarMeta() {
        if (!nowBarEl) return { name: '', desc: '', image: '' };
        const imgEl = nowBarEl.querySelector('img');
        const titleEl = nowBarEl.querySelector('.img-title-info');
        const descEl = nowBarEl.querySelector('.img-des-info');
        return {
            name: titleEl ? titleEl.textContent.trim() : '',
            desc: descEl ? descEl.textContent.trim() : '',
            image: imgEl ? imgEl.getAttribute('src') : ''
        };
    }

    // Agar offline hone ki wajah se session check fail ho gaya ho (auth.js
    // window.currentUser ko null kar deta hai), to bhi is device par pehle
    // login kiye hue user ki id (auth.js ne save ki hui) use karo - warna
    // downloads ki galat (khaali "guest") database khul jati. Hum yahan
    // navigator.onLine par depend nahi karte (kai browsers/OS me ye reliably
    // sahi report nahi karta, aur page-load ke turant baad race condition ban
    // sakti thi) - bas itna dekhte hain ke koi cached identity maujood hai ya
    // nahi. Genuine logout (401 ya "Log out" button) par ye cache khud
    // saaf ho jati hai (auth.js), is liye galat user par kabhi nahi atakta.
    function lastKnownUid() {
        try { return localStorage.getItem('melodiax-last-uid'); } catch (err) { return null; }
    }

    function currentUid() {
        if (window.currentUser && window.currentUser.id) return window.currentUser.id;
        const cached = lastKnownUid();
        if (cached) return cached;
        return 'guest';
    }

    // Downloads sirf logged-in (sign up/log in kiye hue) users ke liye - guest
    // (login/signup na kiya hua) kabhi bhi kuch download nahi kar sakta.
    function isLoggedIn() {
        return !!(window.currentUser && window.currentUser.id);
    }

    // Downloads TAB/section dekhne ke liye - normal login se, YA is device par
    // pehle se login wale (abhi tak logout na hue) user ki cached id se (naya
    // download shuru karne ke liye phir bhi asal isLoggedIn() hi chahiye,
    // kyunki us ke liye network chahiye hota hai).
    function hasOfflineAccess() {
        return isLoggedIn() || !!lastKnownUid();
    }

    // Har user ki apni database - "melodiax-offline_<userId>", guest ke liye
    // "melodiax-offline_guest".
    function getDbName() {
        return 'melodiax-offline_' + currentUid();
    }

    function openDb() {
        const name = getDbName();
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(name, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Purane downloaded records me ye metadata khaali (blank) save ho chuka ho
    // sakta hai (upar wale bug ki wajah se, jo ab fix ho chuka hai). Playback/
    // list ke waqt agar rec.name/image khaali mile, to global `songs` array
    // se (agar wahi id mil jaye) asal data nikal lete hain - taake purane
    // downloads bhi turant sahi dikhein, naya download hone ka wait na karna pade.
    function resolveSongMeta(id, rec) {
        let name = (rec && rec.name) || '';
        let desc = (rec && rec.desc) || '';
        let image = (rec && rec.image) || '';
        if ((!name || !image) && typeof songs !== 'undefined' && Array.isArray(songs)) {
            const s = songs.find((song, i) => String(song.trackId !== undefined ? song.trackId : i + 1) === String(id));
            if (s) {
                if (!name) name = s.songName || '';
                if (!desc) desc = s.songDes || '';
                if (!image) image = s.songImage || '';
            }
        }
        return { name, desc, image };
    }

    // Jo bhi behtar/nayi metadata resolveSongMeta() se mili ho, use IndexedDB
    // record me bhi permanently save kar do (best-effort) - taake agli baar
    // (offline hone par bhi, jab `songs` array me admin track na ho) yehi
    // sahi data mil jaye, resolveSongMeta() par dobara depend na karna pade.
    async function healOfflineMetaIfNeeded(id, rec, resolved) {
        const changed = (rec.name || '') !== resolved.name || (rec.desc || '') !== resolved.desc || (rec.image || '') !== resolved.image;
        if (!changed) return;
        try {
            const full = await getOfflineSong(id); // blob ke sath poora record
            if (full && full.blob) await saveOfflineSong(id, full.blob, resolved);
        } catch (err) { /* best-effort hi hai, fail ho to koi baat nahi */ }
    }

    function saveOfflineSong(id, blob, meta) {
        return openDb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({
                id: String(id),
                blob,
                name: (meta && meta.name) || '',
                image: (meta && meta.image) || '',
                desc: (meta && meta.desc) || '',
                downloadedAt: Date.now()
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        }));
    }

    function getOfflineSong(id) {
        return openDb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(String(id));
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    }

    function deleteOfflineSong(id) {
        return openDb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(String(id));
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        }));
    }

    function listOfflineIds() {
        return openDb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAllKeys();
            req.onsuccess = () => resolve((req.result || []).map(String));
            req.onerror = () => reject(req.error);
        }));
    }

    // Downloads tab (grid) ke liye - blob ke bagair sirf metadata (id, name,
    // image, desc, downloadedAt) sabhi records.
    function listAllOfflineSongs() {
        return openDb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).getAll();
            req.onsuccess = () => {
                const list = (req.result || []).map((r) => ({
                    id: r.id, name: r.name, image: r.image, desc: r.desc, downloadedAt: r.downloadedAt
                }));
                list.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
                resolve(list);
            };
            req.onerror = () => reject(req.error);
        }));
    }

    // Blob URL cache (ek hi page-load ke andar) - har baar naya URL banane
    // se bacha jaye taake memory leak na ho.
    const blobUrlCache = new Map();

    async function getOfflinePlayUrl(id) {
        id = String(id);
        if (blobUrlCache.has(id)) return blobUrlCache.get(id);
        const rec = await getOfflineSong(id);
        if (!rec) return null;
        const url = URL.createObjectURL(rec.blob);
        blobUrlCache.set(id, url);
        return url;
    }

    function revokeOfflineUrl(id) {
        id = String(id);
        const url = blobUrlCache.get(id);
        if (url) {
            URL.revokeObjectURL(url);
            blobUrlCache.delete(id);
        }
    }

    // User switch (login/logout) par purane user ke sabhi blob URLs revoke
    // kar do - warna wo dusre account ki (ab band ho chuki) database ko
    // point karte reh jate.
    function revokeAllOfflineUrls() {
        blobUrlCache.forEach((url) => URL.revokeObjectURL(url));
        blobUrlCache.clear();
    }

    // Script.js/admin.js is se offline copy check karke Audio/N.mp3 ki jagah
    // istemal karte hain (agar mojood ho).
    window.melodiaxOffline = {
        save: saveOfflineSong,
        get: getOfflineSong,
        delete: deleteOfflineSong,
        listIds: listOfflineIds,
        listAll: listAllOfflineSongs,
        getPlayUrl: getOfflinePlayUrl
    };

    // ---------------- Download button UI ----------------
    function getSongSourceUrl(id) {
        if (typeof songs !== 'undefined' && Array.isArray(songs)) {
            const s = songs.find((song, i) => String(song.trackId !== undefined ? song.trackId : i + 1) === String(id));
            if (s && s.songPath) return s.songPath;
        }
        return `Audio/${id}.mp3`;
    }

    function setBtnState(btn, state) {
        btn.classList.remove('downloading', 'downloaded');
        if (state === 'downloaded') {
            btn.classList.add('downloaded');
            btn.title = 'Offline copy available - click to remove';
            btn.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        } else if (state === 'downloading') {
            btn.classList.add('downloading');
            btn.title = 'Downloading...';
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        } else {
            btn.title = 'Download for offline';
            btn.innerHTML = '<i class="fa-solid fa-download"></i>';
        }
    }

    async function handleDownloadClick(btn, card, icon, id) {
        const isDownloaded = btn.classList.contains('downloaded');
        if (isDownloaded) {
            const ok = window.showConfirm
                ? await window.showConfirm('Delete this offline copy?', { confirmText: 'Delete' })
                : window.confirm('Delete this offline copy?');
            if (!ok) return;
            await deleteOfflineSong(id);
            revokeOfflineUrl(id);
            setBtnState(btn, 'idle');
            afterOfflineChange(id);
            return;
        }

        setBtnState(btn, 'downloading');
        try {
            const src = getSongSourceUrl(id);
            const res = await fetch(src);
            if (!res.ok) throw new Error('Fetch failed: ' + res.status);
            const blob = await res.blob();
            const titleEl = card.querySelector('.img-title');
            const descEl = card.querySelector('.img-description');
            const imgEl = card.querySelector('img');
            await saveOfflineSong(id, blob, {
                name: titleEl ? titleEl.textContent.trim() : '',
                desc: descEl ? descEl.textContent.trim() : '',
                image: imgEl ? imgEl.getAttribute('src') : ''
            });
            setBtnState(btn, 'downloaded');
            afterOfflineChange(id);
        } catch (err) {
            console.warn('Offline download failed:', err);
            setBtnState(btn, 'idle');
        }
    }

    // Kisi bhi gaane ki offline state save/delete hone ke baad - Download nav
    // button ki visibility, khuli hui Downloads grid, aur player-bar wale
    // download icon (agar wahi gaana is waqt baj raha ho) sab sync kar do.
    async function afterOfflineChange(changedId) {
        await updateDownloadsNavVisibility();
        if (downloadsSection && downloadsSection.style.display !== 'none') {
            renderDownloadsGrid();
        }
        if (playerDownloadBtn && playerDownloadBtn.dataset.songId === String(changedId)) {
            const rec = await getOfflineSong(changedId);
            setPlayerBtnState(rec ? 'downloaded' : 'idle');
        }
    }

    // NOTE: Song cards khud par ab download button nahi dikhate - download
    // sirf niche wale main player-bar (.now-bar, #player-download-btn) se hi
    // hota hai, currently-playing gaane ke liye. Ye function/observer isi
    // liye hata diye gaye hain; window.melodiaxRefreshDownloadButtons ab bhi
    // (no-op) maujood hai taake purana koi call kahin crash na kare.
    window.melodiaxRefreshDownloadButtons = () => {};

    // ---------------- "Download" nav tab (sirf downloaded SONGS ki grid) ----------------
    const downloadsNavBtn = document.getElementById('nav-downloads-btn');
    const downloadsSection = document.getElementById('downloads-view-section');
    const downloadsGrid = document.getElementById('downloads-view-grid');
    const downloadsEmptyMsg = document.getElementById('downloads-view-empty');
    const homeIconEl = document.querySelector('.home-icon');

    async function updateDownloadsNavVisibility() {
        if (!downloadsNavBtn) return;
        if (!hasOfflineAccess()) { downloadsNavBtn.style.display = 'none'; return; }
        try {
            const ids = await listOfflineIds();
            downloadsNavBtn.style.display = ids.length ? '' : 'none';
        } catch (err) {
            downloadsNavBtn.style.display = 'none';
        }
    }

    function escapeHtmlLocal(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    async function renderDownloadsGrid() {
        if (!downloadsGrid) return;
        const list = await listAllOfflineSongs();
        downloadsGrid.innerHTML = '';
        if (downloadsEmptyMsg) downloadsEmptyMsg.style.display = list.length ? 'none' : '';
        list.forEach((rec) => {
            const meta = resolveSongMeta(rec.id, rec);
            healOfflineMetaIfNeeded(rec.id, rec, meta);
            const card = document.createElement('div');
            // Playlist grid ke same classes reuse karte hain - taake styling
            // automatically identical rahe.
            card.className = 'playlist-view-card';
            card.innerHTML =
                '<div class="playlist-view-cover">' +
                    (meta.image ? '<img src="' + meta.image + '" alt="">' : '<i class="fa-solid fa-music"></i>') +
                    '<button type="button" class="playlist-view-play" title="Play"><i class="fa-solid fa-play"></i></button>' +
                '</div>' +
                '<div class="playlist-view-info">' +
                    '<div class="playlist-view-name">' + escapeHtmlLocal(meta.name || 'Untitled') + '</div>' +
                    '<div class="playlist-view-count">Downloaded</div>' +
                '</div>' +
                '<div class="playlist-view-actions">' +
                    '<button type="button" class="playlist-view-delete"><i class="fa-solid fa-trash"></i> Delete</button>' +
                '</div>';

            card.querySelector('.playlist-view-play').addEventListener('click', (e) => {
                e.stopPropagation();
                playDownloadedSong(rec);
            });
            card.querySelector('.playlist-view-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = window.showConfirm
                    ? await window.showConfirm('Delete this offline copy?', { confirmText: 'Delete' })
                    : window.confirm('Delete this offline copy?');
                if (!ok) return;
                await deleteOfflineSong(rec.id);
                revokeOfflineUrl(rec.id);
                // Homepage/grid ke us gaane ke download-icon ko bhi "idle" state me wapas le aao
                const cardIcon = document.getElementById(rec.id);
                const homeCardBtn = cardIcon ? cardIcon.closest('.music-card')?.querySelector('.music-download-btn') : null;
                if (homeCardBtn) setBtnState(homeCardBtn, 'idle');
                afterOfflineChange(rec.id);
            });
            card.addEventListener('click', () => playDownloadedSong(rec));

            downloadsGrid.appendChild(card);
        });
    }

    function playDownloadedSong(rec) {
        getOfflinePlayUrl(rec.id).then((url) => {
            if (!url) return;
            if (typeof makeAllPlay === 'function') makeAllPlay();
            const icon = document.getElementById(rec.id);
            if (icon) { icon.classList.remove('fa-circle-play'); icon.classList.add('fa-circle-pause'); }
            if (typeof play !== 'undefined' && play) { play.classList.remove('fa-circle-play'); play.classList.add('fa-circle-pause'); }
            try { index = parseInt(rec.id, 10); currentSong = parseInt(rec.id, 10); } catch (err) { /* globals na milein to ignore */ }
            audio.src = url;
            audio.currentTime = 0;
            audio.play();
            // rec (IndexedDB record) me is gaane ka naam/image/desc pehle se
            // maujood hai - lekin agar wo purana/khaali ho (fixed bug se
            // pehle download hua tha), resolveSongMeta() `songs` array se
            // asal data nikal leta hai. Seedha isi se player-bar update karo,
            // `order`/`songs` array ke index par depend na karein.
            const meta = resolveSongMeta(rec.id, rec);
            healOfflineMetaIfNeeded(rec.id, rec, meta);
            if (typeof updateNowBar === 'function') {
                updateNowBar({ songImage: meta.image, songName: meta.name, songDes: meta.desc });
            }
            updatePlayerDownloadBtn(rec.id, false);
        });
    }

    // Playlist tab jaisa hi smooth crossfade (Style.css ka shared
    // ".view-hidden" transition use karta hai - #downloads-view-section
    // us CSS rule mein already shamil hai).
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

    function hideDownloadsTab() {
        if (!downloadsSection || downloadsSection.style.display === 'none') return;
        fadeOutThen([downloadsSection], () => {
            downloadsSection.style.display = 'none';
        });
    }

    async function showDownloadsTab() {
        // Home sections aur Playlist tab dono chupa do (playlist.js apni taraf
        // se downloads-view-section ko already chupata hai jab wo apna tab dikhata hai).
        const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
        const playlistsSection = document.getElementById('playlists-view-section');
        if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(false);
        // About tab agar khula ho to usko bhi chupa do.
        if (typeof window.melodiaxHideAboutTab === 'function') window.melodiaxHideAboutTab();

        await renderDownloadsGrid();

        fadeOutThen([...homeSections, playlistsSection], () => {
            homeSections.forEach((sec) => { sec.style.display = 'none'; });
            if (playlistsSection) playlistsSection.style.display = 'none';
            if (downloadsSection) {
                downloadsSection.style.display = 'block';
                fadeIn([downloadsSection]);
            }
        });
    }

    if (downloadsNavBtn) downloadsNavBtn.addEventListener('click', showDownloadsTab);
    // Home icon click par (playlist.js ka apna listener bhi lagega) downloads tab bhi chupa do.
    if (homeIconEl) homeIconEl.addEventListener('click', hideDownloadsTab);

    window.melodiaxHideDownloadsTab = hideDownloadsTab;

    // ---------------- Player-bar download icon (currently playing song) ----------------
    const playerDownloadBtn = document.getElementById('player-download-btn');

    function setPlayerBtnState(state) {
        if (!playerDownloadBtn) return;
        playerDownloadBtn.classList.remove('downloading', 'downloaded');
        if (state === 'downloaded') {
            playerDownloadBtn.classList.add('downloaded');
            playerDownloadBtn.title = 'Downloaded - offline available (click to remove)';
            playerDownloadBtn.className = 'fa-solid fa-check player-download-btn downloaded';
        } else if (state === 'downloading') {
            playerDownloadBtn.classList.add('downloading');
            playerDownloadBtn.title = 'Downloading...';
            playerDownloadBtn.className = 'fa-solid fa-arrow-down player-download-btn downloading';
        } else {
            playerDownloadBtn.title = 'Download for offline';
            playerDownloadBtn.className = 'fa-solid fa-download player-download-btn';
        }
    }

    // Script.js/admin.js har baar naya gaana bajne par ye call karte hain -
    // taake player-bar wala download icon hamesha "is waqt baj raha" gaane
    // ki sahi state (downloaded/idle) dikhaye.
    async function updatePlayerDownloadBtn(id, isYoutube) {
        if (!playerDownloadBtn) return;
        // songId hamesha pehle set kar do (login state se independent) - taake
        // baad me login hone par 'melodiax-auth-changed' handler ko pata ho
        // ke abhi konsa gaana baj raha hai, aur button turant wapas dikha sake
        // (pehle yahan early-return se pehle hi return ho jata tha, is liye
        // guest ke tor par gaana chalane ke baad login karne se bhi button
        // hidden hi reh jata tha jab tak agla/pichla gaana na chalayein).
        if (id !== undefined && id !== null) playerDownloadBtn.dataset.songId = String(id);
        if (!isLoggedIn() || isYoutube || id === undefined || id === null) {
            playerDownloadBtn.style.display = 'none';
            return;
        }
        playerDownloadBtn.style.display = '';
        try {
            const rec = await getOfflineSong(id);
            setPlayerBtnState(rec ? 'downloaded' : 'idle');
        } catch (err) {
            setPlayerBtnState('idle');
        }
    }
    window.melodiaxUpdatePlayerDownloadBtn = updatePlayerDownloadBtn;

    if (playerDownloadBtn) {
        playerDownloadBtn.addEventListener('click', async () => {
            // Defense in depth: button chhupa hota hai guest ke liye, lekin agar
            // kisi wajah se (race condition, stale DOM state) click phir bhi aa
            // jaye to download karne ke bajaye login/signup modal khol do.
            if (!isLoggedIn()) {
                if (typeof window.openModal === 'function') window.openModal('login');
                return;
            }
            const id = playerDownloadBtn.dataset.songId;
            if (!id) return;
            const isDownloaded = playerDownloadBtn.classList.contains('downloaded');
            if (isDownloaded) {
                const ok = window.showConfirm
                    ? await window.showConfirm('Delete this offline copy?', { confirmText: 'Delete' })
                    : window.confirm('Delete this offline copy?');
                if (!ok) return;
                await deleteOfflineSong(id);
                revokeOfflineUrl(id);
                setPlayerBtnState('idle');
                const cardIcon = document.getElementById(id);
                const homeCardBtn = cardIcon ? cardIcon.closest('.music-card')?.querySelector('.music-download-btn') : null;
                if (homeCardBtn) setBtnState(homeCardBtn, 'idle');
                afterOfflineChange(id);
                return;
            }
            setPlayerBtnState('downloading');
            try {
                const cardIcon = document.getElementById(id);
                const card = cardIcon ? cardIcon.closest('.music-card') : null;
                const src = getSongSourceUrl(id);
                const res = await fetch(src);
                if (!res.ok) throw new Error('Fetch failed: ' + res.status);
                const blob = await res.blob();
                // Pehle sirf home-card se naam/image/desc dhoondte the - agar
                // wo card DOM me na ho (jaise admin/YouTube track jiska card
                // render hi nahi hua, ya kabhi hata diya gaya ho) to khaali
                // metadata save ho jata tha, is liye downloads tab me phir
                // controller par kuch dikhta hi nahi tha. Ab pehle now-bar se
                // lete hain (hamesha sahi/current), card sirf fallback hai.
                const nowBarMeta = getNowBarMeta();
                const titleEl = card ? card.querySelector('.img-title') : null;
                const descEl = card ? card.querySelector('.img-description') : null;
                const imgEl = card ? card.querySelector('img') : null;
                await saveOfflineSong(id, blob, {
                    name: nowBarMeta.name || (titleEl ? titleEl.textContent.trim() : ''),
                    desc: nowBarMeta.desc || (descEl ? descEl.textContent.trim() : ''),
                    image: nowBarMeta.image || (imgEl ? imgEl.getAttribute('src') : '')
                });
                setPlayerBtnState('downloaded');
                const homeCardBtn = card ? card.querySelector('.music-download-btn') : null;
                if (homeCardBtn) setBtnState(homeCardBtn, 'downloaded');
                afterOfflineChange(id);
            } catch (err) {
                console.warn('Offline download failed:', err);
                setPlayerBtnState('idle');
            }
        });
    }

    // Pehli load pe bhi Download nav button ki visibility set kardo (agar
    // pehle se koi gaana downloaded ho).
    updateDownloadsNavVisibility();

    // ---------------- Login/logout par user switch ----------------
    // auth.js har login/logout ke baad 'melodiax-auth-changed' fire karta hai
    // (playlist.js isi event par apni playlists reload karta hai). Yahan bhi
    // usi par: purane user ke blob URLs revoke karo, aur nav badge/khuli
    // Downloads grid/player-bar icon ko naye (ab logged-in) user ki apni
    // downloads dikhane ke liye refresh kar do.
    window.addEventListener('melodiax-auth-changed', async () => {
        revokeAllOfflineUrls();
        await updateDownloadsNavVisibility();
        if (!hasOfflineAccess()) {
            // Guest ke liye downloads bilkul available nahi - khuli hui
            // Downloads tab band kar do aur player-bar icon chupa do.
            hideDownloadsTab();
            if (playerDownloadBtn) playerDownloadBtn.style.display = 'none';
            return;
        }
        if (downloadsSection && downloadsSection.style.display !== 'none') {
            await renderDownloadsGrid();
        }
        if (playerDownloadBtn && playerDownloadBtn.dataset.songId) {
            const rec = await getOfflineSong(playerDownloadBtn.dataset.songId).catch(() => null);
            playerDownloadBtn.style.display = '';
            setPlayerBtnState(rec ? 'downloaded' : 'idle');
        }
    });
})();
