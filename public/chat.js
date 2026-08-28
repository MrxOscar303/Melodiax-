// ============================================================
// Friends Chat - kisi friend par sidebar list mein click karte hi poori
// screen par khulti hai (Playlist/Downloads/Premium jaisa hi tab pattern).
// Text, GIF (Giphy), stickers (emoji), aur voice messages - sab support
// karta hai. Har 4 second baad naye messages ke liye halka poll karta hai.
// ============================================================
(function () {
    const API = '/api/messages';
    const POLL_INTERVAL_MS = 4000;

    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // GIF picker Giphy API use karta hai - https://developers.giphy.com se
    // (free) apni khud ki API key banayein aur yahan daal dein. Jab tak
    // key nahi daali jati, GIF picker khulne par ek chhota sa message
    // dikhayega ke key set nahi hui - baaki poora chat (text/sticker/voice)
    // bina kisi key ke bhi kaam karta hai.
    const GIPHY_API_KEY = 'zKDelWwdBYdYAWxBpJXyM8q4GBvXeZCC';
    // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    const STICKERS = [
        '😀', '😂', '😍', '🥳', '😎', '🤔', '😢', '😡',
        '👍', '👎', '🙏', '👏', '💪', '🤝', '✌️', '🤞',
        '❤️', '🔥', '✨', '🎉', '🎶', '💯', '😴', '👀',
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

    const gifPickerBtn = document.getElementById('gif-picker-btn');
    const gifPickerPanel = document.getElementById('gif-picker-panel');
    const gifSearchInput = document.getElementById('gif-search-input');
    const gifPickerGrid = document.getElementById('gif-picker-grid');

    const stickerPickerBtn = document.getElementById('sticker-picker-btn');
    const stickerPickerPanel = document.getElementById('sticker-picker-panel');
    const stickerPickerGrid = document.getElementById('sticker-picker-grid');

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
        return `<p class="chat-bubble-text">${escapeHtml(m.content)}</p>`;
    }

    function renderMessages(messages) {
        if (!chatMessagesEl) return;
        if (!messages.length) {
            chatMessagesEl.innerHTML = '<p class="chat-empty">No messages yet - say hi!</p>';
            lastMessageCount = 0;
            return;
        }

        let html = '';
        let lastDay = null;
        messages.forEach((m) => {
            const dayLabel = formatDayLabel(m.createdAt);
            if (dayLabel !== lastDay) {
                html += `<div class="chat-day-divider"><span>${dayLabel}</span></div>`;
                lastDay = dayLabel;
            }
            const bareType = m.type === 'gif' || m.type === 'sticker'; // in par bubble background nahi chahiye
            html += `
                <div class="chat-bubble-row ${m.mine ? 'chat-bubble-row-mine' : ''}">
                    <div class="chat-bubble ${bareType ? 'chat-bubble-bare' : ''} ${m.type === 'voice' ? 'chat-bubble-voice' : ''}">
                        ${renderBubbleContent(m)}
                        <span class="chat-bubble-time">${formatTime(m.createdAt)}</span>
                    </div>
                </div>
            `;
        });
        chatMessagesEl.innerHTML = html;

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

    if (chatSendBtn) chatSendBtn.addEventListener('click', sendMessage);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
        });
    }

    // ---------------- GIF picker (Giphy) ----------------
    function closeAllPickers() {
        if (gifPickerPanel) gifPickerPanel.style.display = 'none';
        if (stickerPickerPanel) stickerPickerPanel.style.display = 'none';
    }

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
        gifPickerBtn.addEventListener('click', () => {
            const isOpen = gifPickerPanel.style.display === 'block';
            closeAllPickers();
            if (!isOpen) {
                gifPickerPanel.style.display = 'block';
                gifSearchInput.value = '';
                searchGifs('');
                gifSearchInput.focus();
            }
        });
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
    if (stickerPickerBtn) {
        stickerPickerBtn.addEventListener('click', () => {
            const isOpen = stickerPickerPanel.style.display === 'block';
            closeAllPickers();
            if (!isOpen) stickerPickerPanel.style.display = 'block';
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
            if (blob.size < 500) return; // bohot chhoti recording (galti se tap) - bhejne ki zaroorat nahi
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
                    || (friend.status === 'dnd' ? 'Do Not Disturb' : friend.status === 'night' ? 'Night' : 'Online');
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
