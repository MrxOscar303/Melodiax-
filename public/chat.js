// ============================================================
// Friends Chat - kisi friend par sidebar list mein click karte hi poori
// screen par khulti hai (Playlist/Downloads/Premium jaisa hi tab pattern).
// Text, GIF (Giphy), stickers (emoji), voice messages, file/document
// uploads, aur song-sharing (embedded card) - sab support karta hai.
// Har 4 second baad naye messages ke liye halka poll karta hai.
// ============================================================
(function () {
    const API = '/api/messages';
    const POLL_INTERVAL_MS = 4000;

    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // GIF picker Giphy API use karta hai - https://developers.giphy.com se
    // (free) apni khud ki API key banayein aur yahan daal dein.
    const GIPHY_API_KEY = 'YOUR_GIPHY_API_KEY';
    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    const STICKERS = [
        '😀', '😂', '😍', '🥳', '😎', '🤔', '😢', '😡',
        '👍', '👎', '🙏', '👏', '💪', '🤝', '✌️', '🤞',
        '❤️', '🔥', '✨', '🎉', '🎶', '💯', '😴', '👀',
    ];
    // Emoji picker (chat text mein insert karne ke liye) - stickers se alag,
    // koi bhi combination type kar sake, thora bara set.
    const EMOJIS = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
        '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗',
        '🤭', '🤫', '🤔', '🤐', '🙄', '😬', '😌', '😔', '😪', '🤤', '😴', '😷',
        '🤒', '🤕', '🤢', '🥵', '🥶', '😵', '🤯', '🥳', '😎', '🤓', '🧐', '😕',
        '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😢', '😭', '😱', '😖', '😩',
        '😤', '😡', '😠', '🤬', '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '❤️',
        '🔥', '✨', '🎉', '🎶', '💯', '👀', '💀', '🥹',
    ];

    const chatViewSection = document.getElementById('chat-view-section');
    const chatBackBtn = document.getElementById('chat-back-btn');
    const chatHeaderAvatar = document.getElementById('chat-header-avatar');
    const chatHeaderStatusDot = document.getElementById('chat-header-status-dot');
    const chatHeaderName = document.getElementById('chat-header-name');
    const chatHeaderStatusText = document.getElementById('chat-header-status-text');
    const chatMessagesEl = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

    const attachMenuBtn = document.getElementById('attach-menu-btn');
    const attachMenuPanel = document.getElementById('attach-menu-panel');
    const attachUploadFileBtn = document.getElementById('attach-upload-file-btn');
    const attachUploadDocumentBtn = document.getElementById('attach-upload-document-btn');
    const attachShareSongBtn = document.getElementById('attach-share-song-btn');
    const attachFileInput = document.getElementById('attach-file-input');
    const attachDocumentInput = document.getElementById('attach-document-input');

    const emojiPickerBtn = document.getElementById('emoji-picker-btn');
    const emojiPickerPanel = document.getElementById('emoji-picker-panel');
    const emojiPickerGrid = document.getElementById('emoji-picker-grid');

    const gifPickerBtn = document.getElementById('gif-picker-btn');
    const gifPickerPanel = document.getElementById('gif-picker-panel');
    const gifSearchInput = document.getElementById('gif-search-input');
    const gifPickerGrid = document.getElementById('gif-picker-grid');

    const stickerPickerBtn = document.getElementById('sticker-picker-btn');
    const stickerPickerPanel = document.getElementById('sticker-picker-panel');
    const stickerPickerGrid = document.getElementById('sticker-picker-grid');

    const songSharePanel = document.getElementById('song-share-panel');
    const songShareSearchInput = document.getElementById('song-share-search-input');
    const songShareList = document.getElementById('song-share-list');

    const voiceRecordBtn = document.getElementById('voice-record-btn');
    const voiceRecordingBar = document.getElementById('voice-recording-bar');
    const voiceRecordingTimer = document.getElementById('voice-recording-timer');
    const voiceCancelBtn = document.getElementById('voice-cancel-btn');
    const voiceStopBtn = document.getElementById('voice-stop-btn');

    if (!chatViewSection) return;

    let currentFriend = null;
    let pollTimer = null;
    let lastMessageCount = 0;
    let gifSearchDebounce = null;
    let songSearchDebounce = null;

    // ---------------- Voice recording state ----------------
    let mediaRecorder = null;
    let recordedChunks = [];
    let recordingStream = null;
    let recordingStartTime = null;
    let recordingTimerInterval = null;

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str == null ? '' : String(str);
        return div.innerHTML;
    }

    function formatTime(dateStr) {
        return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function formatDayLabel(dateStr) {
        const d = new Date(dateStr);
        const today = new Date();
        const isToday = d.toDateString() === today.toDateString();
        if (isToday) return 'Today';
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function formatDuration(seconds) {
        const s = Math.max(0, Math.round(seconds || 0));
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async function apiGet(path) {
        const res = await fetch(API + path, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    }
    async function apiPost(path, body) {
        const res = await fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body || {}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return data;
    }

    // ---------------- Message bubble rendering (per type) ----------------
    function songThumbnail(song) {
        if (song.image) return song.image;
        return `https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`;
    }

    function renderBubbleContent(m) {
        if (m.type === 'gif') {
            return `<img src="${escapeHtml(m.content)}" alt="GIF" class="chat-gif-img">`;
        }
        if (m.type === 'sticker') {
            return `<span class="chat-sticker-emoji">${escapeHtml(m.content)}</span>`;
        }
        if (m.type === 'voice') {
            return `
                <audio controls preload="none" class="chat-voice-audio" src="${escapeHtml(m.content)}"></audio>
                ${m.voiceDuration ? `<span class="chat-voice-duration">${formatDuration(m.voiceDuration)}</span>` : ''}
            `;
        }
        if (m.type === 'file') {
            let file;
            try { file = JSON.parse(m.content); } catch (e) { file = null; }
            if (!file) return `<p class="chat-bubble-text">Shared a file</p>`;
            return `
                <a href="${escapeHtml(file.url)}" download="${escapeHtml(file.filename)}" target="_blank" rel="noopener" class="chat-file-card">
                    <i class="fa-solid fa-file-arrow-down chat-file-icon"></i>
                    <span class="chat-file-info">
                        <span class="chat-file-name">${escapeHtml(file.filename)}</span>
                        <span class="chat-file-size">${escapeHtml(formatFileSize(file.size))}</span>
                    </span>
                </a>
            `;
        }
        if (m.type === 'song') {
            let song;
            try { song = JSON.parse(m.content); } catch (e) { song = null; }
            if (!song) return `<p class="chat-bubble-text">Shared a song</p>`;
            return `
                <div class="chat-song-card" data-song-id="${escapeHtml(song.dbId)}">
                    <img src="${escapeHtml(song.image)}" alt="" class="chat-song-thumb">
                    <span class="chat-song-info">
                        <span class="chat-song-title">${escapeHtml(song.title)}</span>
                        <span class="chat-song-section">${escapeHtml(song.section || '')}</span>
                    </span>
                    <button type="button" class="chat-song-play-btn" data-song-id="${escapeHtml(song.dbId)}" title="Play">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </div>
            `;
        }
        return `<p class="chat-bubble-text">${escapeHtml(m.content)}</p>`;
    }

    function wireSongPlayButtons(container) {
        container.querySelectorAll('.chat-song-play-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const dbId = btn.getAttribute('data-song-id');
                // "songs" Script.js mein `const` se bani hai - is liye
                // window.songs nahi, seedha global identifier "songs" hi
                // access hota hai (classic <script> tags aapas mein isi
                // tarah top-level const/let share karte hain).
                const list = (typeof songs !== 'undefined' && Array.isArray(songs)) ? songs : [];
                const track = list.find((s) => s.dbId === dbId);
                if (track && typeof window.playTrackData === 'function') {
                    window.playTrackData(track);
                } else {
                    window.alert('This song could not be found - it may have been removed.');
                }
            });
        });
    }

    function renderMessages(messages) {
        if (!chatMessagesEl) return;
        if (!messages.length) {
            chatMessagesEl.innerHTML = '<p class="chat-empty">No messages yet - say hi!</p>';
            lastMessageCount = 0;
            return;
        }

        let lastMineIndex = -1;
        messages.forEach((m, i) => { if (m.mine) lastMineIndex = i; });

        let html = '';
        let lastDay = null;
        messages.forEach((m, i) => {
            const dayLabel = formatDayLabel(m.createdAt);
            if (dayLabel !== lastDay) {
                html += `<div class="chat-day-divider"><span>${dayLabel}</span></div>`;
                lastDay = dayLabel;
            }
            const bareType = m.type === 'gif' || m.type === 'sticker'; // in par bubble background nahi chahiye
            const cardType = m.type === 'file' || m.type === 'song'; // in ka apna card-style look hai
            const seenLabel = (i === lastMineIndex) ? `<span class="chat-seen-label">${m.read ? 'Seen' : 'Delivered'}</span>` : '';
            html += `
                <div class="chat-bubble-row ${m.mine ? 'chat-bubble-row-mine' : ''}">
                    <div class="chat-bubble ${bareType ? 'chat-bubble-bare' : ''} ${m.type === 'voice' ? 'chat-bubble-voice' : ''} ${cardType ? 'chat-bubble-card' : ''}">
                        ${renderBubbleContent(m)}
                        <span class="chat-bubble-time">${formatTime(m.createdAt)}</span>
                    </div>
                </div>
                ${seenLabel}
            `;
        });
        chatMessagesEl.innerHTML = html;
        wireSongPlayButtons(chatMessagesEl);

        if (messages.length !== lastMessageCount) {
            chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
        lastMessageCount = messages.length;
    }

    async function loadHistory(friendId, { silent } = {}) {
        try {
            const data = await apiGet('/' + friendId);
            renderMessages(data.messages || []);
        } catch (err) {
            if (!silent && chatMessagesEl) {
                chatMessagesEl.innerHTML = `<p class="chat-empty">${escapeHtml(err.message)}</p>`;
            }
        }
    }

    async function sendMessage() {
        if (!currentFriend || !chatInput) return;
        const content = chatInput.value.trim();
        if (!content) return;
        chatInput.value = '';
        chatInput.disabled = true;
        try {
            await apiPost('/', { to: currentFriend.id, content, type: 'text' });
            await loadHistory(currentFriend.id, { silent: true });
        } catch (err) {
            window.alert(err.message);
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    async function sendGif(gifUrl) {
        if (!currentFriend) return;
        closeAllPickers();
        try {
            await apiPost('/', { to: currentFriend.id, content: gifUrl, type: 'gif' });
            await loadHistory(currentFriend.id, { silent: true });
        } catch (err) {
            window.alert(err.message);
        }
    }

    async function sendSticker(emoji) {
        if (!currentFriend) return;
        closeAllPickers();
        try {
            await apiPost('/', { to: currentFriend.id, content: emoji, type: 'sticker' });
            await loadHistory(currentFriend.id, { silent: true });
        } catch (err) {
            window.alert(err.message);
        }
    }

    async function sendSong(song) {
        if (!currentFriend) return;
        closeAllPickers();
        try {
            const payload = JSON.stringify({
                dbId: song._id,
                title: song.title,
                image: songThumbnail(song),
                section: song.section,
            });
            await apiPost('/', { to: currentFriend.id, content: payload, type: 'song' });
            await loadHistory(currentFriend.id, { silent: true });
        } catch (err) {
            window.alert(err.message);
        }
    }

    async function sendFile(file) {
        if (!currentFriend) return;
        closeAllPickers();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('to', currentFriend.id);
        try {
            const res = await fetch(API + '/file', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Could not send file.');
            await loadHistory(currentFriend.id, { silent: true });
        } catch (err) {
            window.alert(err.message);
        }
    }

    if (chatSendBtn) chatSendBtn.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
        });
    }

    // ---------------- Panels: open/close (sirf ek waqt mein ek hi khula rahe) ----------------
    function closeAllPickers() {
        if (attachMenuPanel) attachMenuPanel.style.display = 'none';
        if (emojiPickerPanel) emojiPickerPanel.style.display = 'none';
        if (gifPickerPanel) gifPickerPanel.style.display = 'none';
        if (stickerPickerPanel) stickerPickerPanel.style.display = 'none';
        if (songSharePanel) songSharePanel.style.display = 'none';
    }
    function togglePanel(panel, onOpen) {
        const isOpen = panel.style.display === 'block';
        closeAllPickers();
        if (!isOpen) {
            panel.style.display = 'block';
            if (onOpen) onOpen();
        }
    }

    // ---------------- "+" attach menu ----------------
    if (attachMenuBtn) attachMenuBtn.addEventListener('click', () => togglePanel(attachMenuPanel));
    if (attachUploadFileBtn) {
        attachUploadFileBtn.addEventListener('click', () => { closeAllPickers(); attachFileInput.click(); });
    }
    if (attachUploadDocumentBtn) {
        attachUploadDocumentBtn.addEventListener('click', () => { closeAllPickers(); attachDocumentInput.click(); });
    }
    if (attachFileInput) {
        attachFileInput.addEventListener('change', () => {
            const file = attachFileInput.files[0];
            attachFileInput.value = '';
            if (file) sendFile(file);
        });
    }
    if (attachDocumentInput) {
        attachDocumentInput.addEventListener('change', () => {
            const file = attachDocumentInput.files[0];
            attachDocumentInput.value = '';
            if (file) sendFile(file);
        });
    }

    // ---------------- Emoji picker (insert into text input) ----------------
    if (emojiPickerGrid) {
        emojiPickerGrid.innerHTML = EMOJIS.map((e) => `<button type="button" class="chat-sticker-option">${e}</button>`).join('');
        emojiPickerGrid.querySelectorAll('.chat-sticker-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (chatInput) {
                    chatInput.value += btn.textContent;
                    chatInput.focus();
                }
            });
        });
    }
    if (emojiPickerBtn) emojiPickerBtn.addEventListener('click', () => togglePanel(emojiPickerPanel));

    // ---------------- GIF picker (Giphy) ----------------
    async function searchGifs(query) {
        if (!gifPickerGrid) return;
        if (!GIPHY_API_KEY || GIPHY_API_KEY === 'YOUR_GIPHY_API_KEY') {
            gifPickerGrid.innerHTML = '<p class="chat-picker-empty">GIF search is not set up yet - add a free Giphy API key in chat.js to enable this.</p>';
            return;
        }
        gifPickerGrid.innerHTML = '<p class="chat-picker-empty">Loading...</p>';
        try {
            const endpoint = query
                ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=pg`
                : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg`;
            const res = await fetch(endpoint);
            const data = await res.json();
            const gifs = data.data || [];
            if (!gifs.length) {
                gifPickerGrid.innerHTML = '<p class="chat-picker-empty">No GIFs found.</p>';
                return;
            }
            gifPickerGrid.innerHTML = gifs.map((g) => `
                <img src="${escapeHtml(g.images.fixed_width_small.url)}"
                     data-full="${escapeHtml(g.images.fixed_height.url)}"
                     alt="GIF" class="chat-picker-gif-thumb">
            `).join('');
            gifPickerGrid.querySelectorAll('.chat-picker-gif-thumb').forEach((img) => {
                img.addEventListener('click', () => sendGif(img.getAttribute('data-full')));
            });
        } catch (err) {
            gifPickerGrid.innerHTML = '<p class="chat-picker-empty">Could not load GIFs, please try again.</p>';
        }
    }

    if (gifPickerBtn) {
        gifPickerBtn.addEventListener('click', () => togglePanel(gifPickerPanel, () => {
            gifSearchInput.value = '';
            searchGifs('');
            gifSearchInput.focus();
        }));
    }
    if (gifSearchInput) {
        gifSearchInput.addEventListener('input', () => {
            clearTimeout(gifSearchDebounce);
            gifSearchDebounce = setTimeout(() => searchGifs(gifSearchInput.value.trim()), 400);
        });
    }

    // ---------------- Sticker picker ----------------
    if (stickerPickerGrid) {
        stickerPickerGrid.innerHTML = STICKERS.map((s) => `<button type="button" class="chat-sticker-option">${s}</button>`).join('');
        stickerPickerGrid.querySelectorAll('.chat-sticker-option').forEach((btn) => {
            btn.addEventListener('click', () => sendSticker(btn.textContent));
        });
    }
    if (stickerPickerBtn) stickerPickerBtn.addEventListener('click', () => togglePanel(stickerPickerPanel));

    // ---------------- Share Song picker ----------------
    async function searchSongs(query) {
        if (!songShareList) return;
        songShareList.innerHTML = '<p class="chat-picker-empty">Loading...</p>';
        try {
            const data = await apiGet('/share/songs?q=' + encodeURIComponent(query || ''));
            const results = data.songs || [];
            if (!results.length) {
                songShareList.innerHTML = '<p class="chat-picker-empty">No songs found.</p>';
                return;
            }
            songShareList.innerHTML = results.map((s) => `
                <div class="song-share-item" data-id="${escapeHtml(s._id)}">
                    <img src="${escapeHtml(songThumbnail(s))}" alt="" class="chat-song-thumb">
                    <span class="chat-song-info">
                        <span class="chat-song-title">${escapeHtml(s.title)}</span>
                        <span class="chat-song-section">${escapeHtml(s.section || '')}</span>
                    </span>
                    <button type="button" class="song-share-send-btn">Send</button>
                </div>
            `).join('');
            songShareList.querySelectorAll('.song-share-item').forEach((item, i) => {
                item.querySelector('.song-share-send-btn').addEventListener('click', () => sendSong(results[i]));
            });
        } catch (err) {
            songShareList.innerHTML = '<p class="chat-picker-empty">Could not load songs.</p>';
        }
    }
    if (attachShareSongBtn) {
        attachShareSongBtn.addEventListener('click', () => togglePanel(songSharePanel, () => {
            songShareSearchInput.value = '';
            searchSongs('');
            songShareSearchInput.focus();
        }));
    }
    if (songShareSearchInput) {
        songShareSearchInput.addEventListener('input', () => {
            clearTimeout(songSearchDebounce);
            songSearchDebounce = setTimeout(() => searchSongs(songShareSearchInput.value.trim()), 400);
        });
    }

    // ---------------- Voice recording ----------------
    function resetRecordingUI() {
        if (voiceRecordingBar) voiceRecordingBar.style.display = 'none';
        if (voiceRecordingTimer) voiceRecordingTimer.textContent = '0:00';
        if (voiceRecordBtn) voiceRecordBtn.classList.remove('chat-tool-btn-recording');
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
        recordedChunks = [];
        recordingStartTime = null;
        if (recordingStream) {
            recordingStream.getTracks().forEach((t) => t.stop());
            recordingStream = null;
        }
        mediaRecorder = null;
    }

    async function startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            window.alert('Voice recording is not supported in this browser.');
            return;
        }
        try {
            recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            window.alert('Microphone access was denied - please allow it to send voice messages.');
            return;
        }
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(recordingStream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start();

        recordingStartTime = Date.now();
        if (voiceRecordingBar) voiceRecordingBar.style.display = 'flex';
        if (voiceRecordBtn) voiceRecordBtn.classList.add('chat-tool-btn-recording');
        recordingTimerInterval = setInterval(() => {
            const secs = Math.floor((Date.now() - recordingStartTime) / 1000);
            if (voiceRecordingTimer) voiceRecordingTimer.textContent = formatDuration(secs);
        }, 250);
    }

    function stopRecordingAndSend() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        const durationSeconds = (Date.now() - recordingStartTime) / 1000;
        mediaRecorder.addEventListener('stop', async () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            resetRecordingUI();
            if (blob.size < 500) return;
            if (!currentFriend) return;

            const formData = new FormData();
            formData.append('audio', blob, 'voice-message.webm');
            formData.append('to', currentFriend.id);
            formData.append('duration', String(Math.round(durationSeconds)));

            try {
                const res = await fetch(API + '/voice', { method: 'POST', credentials: 'include', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Could not send voice message.');
                await loadHistory(currentFriend.id, { silent: true });
            } catch (err) {
                window.alert(err.message);
            }
        }, { once: true });
        mediaRecorder.stop();
    }

    function cancelRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.addEventListener('stop', resetRecordingUI, { once: true });
            mediaRecorder.stop();
        } else {
            resetRecordingUI();
        }
    }

    if (voiceRecordBtn) {
        voiceRecordBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopRecordingAndSend();
            } else {
                closeAllPickers();
                startRecording();
            }
        });
    }
    if (voiceStopBtn) voiceStopBtn.addEventListener('click', stopRecordingAndSend);
    if (voiceCancelBtn) voiceCancelBtn.addEventListener('click', cancelRecording);

    function startPolling(friendId) {
        stopPolling();
        pollTimer = setInterval(() => loadHistory(friendId, { silent: true }), POLL_INTERVAL_MS);
    }
    function stopPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    }

    // ---------------- Fade helpers (baaki tabs jaisa hi pattern) ----------------
    function fadeOutThen(elements, after) {
        const visible = elements.filter((el) => el && el.style.display !== 'none');
        if (!visible.length) { after(); return; }
        visible.forEach((el) => el.classList.add('view-hidden'));
        setTimeout(after, 220);
    }
    function fadeIn(elements) {
        elements.forEach((el) => { if (el) el.classList.add('view-hidden'); });
        if (elements[0]) void elements[0].offsetWidth;
        requestAnimationFrame(() => {
            elements.forEach((el) => { if (el) el.classList.remove('view-hidden'); });
        });
    }

    function openChatWithFriend(friend) {
        currentFriend = friend;
        closeAllPickers();
        resetRecordingUI();

        if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(false);
        if (typeof window.melodiaxHideDownloadsTab === 'function') window.melodiaxHideDownloadsTab();
        if (typeof window.melodiaxHideAboutTabInstant === 'function') window.melodiaxHideAboutTabInstant();
        if (typeof window.melodiaxHidePremiumTabInstant === 'function') window.melodiaxHidePremiumTabInstant();
        if (typeof window.melodiaxHideFriendsTabInstant === 'function') window.melodiaxHideFriendsTabInstant();

        const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
        const playlistsSection = document.getElementById('playlists-view-section');
        const downloadsSection = document.getElementById('downloads-view-section');

        fadeOutThen([...homeSections, playlistsSection, downloadsSection], () => {
            homeSections.forEach((sec) => { sec.style.display = 'none'; });
            if (playlistsSection) playlistsSection.style.display = 'none';
            if (downloadsSection) downloadsSection.style.display = 'none';

            chatHeaderAvatar.src = friend.profilePicture || '/uploads/avatars/default-avatar.png';
            chatHeaderName.textContent = '@' + friend.username;
            if (chatHeaderStatusDot) {
                chatHeaderStatusDot.className = 'status-dot status-' + (friend.status || 'online');
                chatHeaderStatusDot.innerHTML = friend.status === 'dnd' ? '<i class="fa-solid fa-minus"></i>'
                    : friend.status === 'night' ? '<i class="fa-solid fa-moon"></i>' : '';
            }
            if (chatHeaderStatusText) {
                chatHeaderStatusText.textContent = friend.statusMessage
                    || (friend.status === 'dnd' ? 'Do Not Disturb' : friend.status === 'night' ? 'Idle' : friend.status === 'invisible' || friend.status === 'offline' ? 'Offline' : 'Online');
            }

            chatViewSection.style.display = 'flex';
            fadeIn([chatViewSection]);
            lastMessageCount = 0;
            loadHistory(friend.id);
            startPolling(friend.id);
            if (chatInput) chatInput.focus();
        });
    }

    function hideChatTabInstant() {
        stopPolling();
        closeAllPickers();
        resetRecordingUI();
        if (chatViewSection) chatViewSection.style.display = 'none';
    }

    function goHomeFromChat() {
        stopPolling();
        closeAllPickers();
        resetRecordingUI();
        currentFriend = null;
        fadeOutThen([chatViewSection], () => {
            if (chatViewSection) chatViewSection.style.display = 'none';
            const homeSections = Array.from(document.querySelectorAll('.main-right-part > .music-section'));
            homeSections.forEach((sec) => { sec.style.display = ''; });
            fadeIn(homeSections);
            if (typeof window.melodiaxSetHomeBannerVisible === 'function') window.melodiaxSetHomeBannerVisible(true);
        });
    }

    if (chatBackBtn) chatBackBtn.addEventListener('click', goHomeFromChat);

    const homeIcon = document.querySelector('.home-icon');
    if (homeIcon) homeIcon.addEventListener('click', hideChatTabInstant);

    window.melodiaxOpenChat = openChatWithFriend;
    window.melodiaxHideChatTabInstant = hideChatTabInstant;
})();
