// ============================================================
// Profile modal - Discord-style card:
//   - View mode (default): avatar with status-colored ring, username,
//     @handle, bio (with "View Full Bio" if long), aur ek action list:
//     Edit Profile / Status selector / Copy Handle.
//   - Edit mode: avatar/username/bio badalne wala form (Edit Profile
//     click karne par khulta hai, "back" arrow se wapas card par).
// ============================================================
(function () {
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('profile-modal-close-btn');
    const userAvatarBtn = document.getElementById('user-avatar');

    const cardView = document.getElementById('profile-card-view');
    const editForm = document.getElementById('profile-edit-form');

    const cardAvatar = document.getElementById('profile-card-avatar');
    const cardStatusDot = document.getElementById('profile-card-status-dot');
    const cardUsername = document.getElementById('profile-card-username');
    const cardHandle = document.getElementById('profile-card-handle');
    const cardBio = document.getElementById('profile-card-bio');
    const cardViewBioBtn = document.getElementById('profile-card-view-bio-btn');

    const editBtn = document.getElementById('profile-card-edit-btn');
    const editBackBtn = document.getElementById('profile-edit-back-btn');

    const statusToggle = document.getElementById('profile-card-status-toggle');
    const statusIcon = document.getElementById('profile-card-status-icon');
    const statusLabelEl = document.getElementById('profile-card-status-label');
    const statusOptionsPanel = document.getElementById('profile-card-status-options');
    const statusMessageInput = document.getElementById('profile-card-status-message-input');

    const copyHandleBtn = document.getElementById('profile-card-copy-handle-btn');

    const avatarPreview = document.getElementById('profile-edit-avatar-preview');
    const avatarBtn = document.getElementById('profile-edit-avatar-btn');
    const avatarInput = document.getElementById('profile-edit-avatar-input');
    const handleText = document.getElementById('profile-handle-text');
    const usernameInput = document.getElementById('profile-edit-username');
    const bioInput = document.getElementById('profile-edit-bio');
    const feedback = document.getElementById('profile-edit-feedback');
    const saveBtn = document.getElementById('profile-edit-save-btn');

    if (!modal || !userAvatarBtn) return;

    let selectedFile = null;

    function statusLabel(status) {
        if (status === 'dnd') return 'Do Not Disturb';
        if (status === 'night') return 'Idle';
        if (status === 'invisible') return 'Invisible';
        return 'Online';
    }
    function statusDotInnerHtml(status) {
        if (status === 'dnd') return '<i class="fa-solid fa-minus"></i>';
        if (status === 'night') return '<i class="fa-solid fa-moon"></i>';
        return '';
    }
    function setStatusDotClass(el, status) {
        el.classList.remove('status-online', 'status-dnd', 'status-night', 'status-invisible');
        el.classList.add(`status-${status || 'online'}`);
        el.innerHTML = statusDotInnerHtml(status);
    }

    function applyStatusToCard(status, statusMessage) {
        if (cardStatusDot) setStatusDotClass(cardStatusDot, status);
        if (statusIcon) setStatusDotClass(statusIcon, status);
        if (statusLabelEl) statusLabelEl.textContent = statusLabel(status);
        if (statusMessageInput) statusMessageInput.value = statusMessage || '';
        document.querySelectorAll('#profile-card-status-options .my-status-option').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-status') === status);
        });
    }
    // friends.js apna status kahin bhi badle (account dropdown se) to
    // profile card bhi turant sync ho jaye.
    window.melodiaxApplyProfileCardStatus = applyStatusToCard;

    function showCardView() {
        if (cardView) cardView.style.display = 'block';
        if (editForm) editForm.style.display = 'none';
        if (statusOptionsPanel) statusOptionsPanel.style.display = 'none';
    }
    function showEditForm() {
        if (cardView) cardView.style.display = 'none';
        if (editForm) editForm.style.display = 'block';
    }

    function openModal() {
        if (!window.currentUser) return;
        const u = window.currentUser;

        cardAvatar.src = u.profilePicture || '/uploads/avatars/default-avatar.png';
        cardUsername.textContent = u.username;
        cardHandle.childNodes[0].textContent = '@' + u.username + ' ';
        applyStatusToCard(u.status, u.statusMessage);

        const bio = (u.bio || '').trim();
        if (bio) {
            cardBio.textContent = bio;
            cardBio.style.display = 'block';
            cardBio.classList.add('profile-card-bio-clamped');
            cardViewBioBtn.style.display = bio.length > 90 ? 'block' : 'none';
        } else {
            cardBio.textContent = 'No bio yet.';
            cardBio.style.display = 'block';
            cardBio.classList.remove('profile-card-bio-clamped');
            cardViewBioBtn.style.display = 'none';
        }

        avatarPreview.src = u.profilePicture || '/uploads/avatars/default-avatar.png';
        handleText.textContent = '@' + u.username;
        usernameInput.value = u.username || '';
        bioInput.value = u.bio || '';
        feedback.textContent = '';
        feedback.className = 'profile-edit-feedback';
        selectedFile = null;

        showCardView();
        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
        if (statusOptionsPanel) statusOptionsPanel.style.display = 'none';
    }

    userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // account dropdown ke hover-open se conflict na ho
        openModal();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (editBtn) editBtn.addEventListener('click', showEditForm);
    if (editBackBtn) editBackBtn.addEventListener('click', showCardView);

    if (cardViewBioBtn) {
        cardViewBioBtn.addEventListener('click', () => {
            cardBio.classList.remove('profile-card-bio-clamped');
            cardViewBioBtn.style.display = 'none';
        });
    }

    // ---------------- Status selector (card ke andar hi) ----------------
    if (statusToggle) {
        statusToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = statusOptionsPanel.style.display === 'block';
            statusOptionsPanel.style.display = isOpen ? 'none' : 'block';
        });
    }
    document.querySelectorAll('#profile-card-status-options .my-status-option').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const status = btn.getAttribute('data-status');
            applyStatusToCard(status, statusMessageInput ? statusMessageInput.value : '');
            if (typeof window.melodiaxApplyMyStatusToUI === 'function') {
                window.melodiaxApplyMyStatusToUI(status, statusMessageInput ? statusMessageInput.value : '');
            }
            try {
                await fetch('/api/friends/status/me', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ status }),
                });
                if (window.currentUser) window.currentUser.status = status;
            } catch (err) { /* silent */ }
        });
    });
    if (statusMessageInput) {
        statusMessageInput.addEventListener('click', (e) => e.stopPropagation());
        let debounceTimer = null;
        statusMessageInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                try {
                    await fetch('/api/friends/status/me', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ statusMessage: statusMessageInput.value }),
                    });
                    if (window.currentUser) window.currentUser.statusMessage = statusMessageInput.value;
                    if (typeof window.melodiaxApplyMyStatusToUI === 'function') {
                        window.melodiaxApplyMyStatusToUI(window.currentUser.status, statusMessageInput.value);
                    }
                } catch (err) { /* silent */ }
            }, 600);
        });
    }

    // ---------------- Copy handle ----------------
    if (copyHandleBtn) {
        copyHandleBtn.addEventListener('click', async () => {
            if (!window.currentUser) return;
            const handle = '@' + window.currentUser.username;
            try {
                await navigator.clipboard.writeText(handle);
            } catch (err) {
                // Clipboard API block ho to bhi user ko handle to dikh hi raha hai card par
            }
            const span = copyHandleBtn.querySelector('span');
            const original = span.textContent;
            span.textContent = 'Copied!';
            setTimeout(() => { span.textContent = original; }, 1200);
        });
    }

    // ---------------- Edit form (avatar/username/bio save) ----------------
    if (avatarBtn) avatarBtn.addEventListener('click', () => avatarInput.click());
    if (avatarInput) {
        avatarInput.addEventListener('change', () => {
            const file = avatarInput.files[0];
            if (!file) return;
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => { avatarPreview.src = ev.target.result; };
            reader.readAsDataURL(file);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const bio = bioInput.value.trim();
            if (username.length < 3) {
                feedback.textContent = 'Username must be at least 3 characters.';
                feedback.className = 'profile-edit-feedback profile-edit-feedback-error';
                return;
            }

            const formData = new FormData();
            formData.append('username', username);
            formData.append('bio', bio);
            if (selectedFile) formData.append('profilePicture', selectedFile);

            saveBtn.disabled = true;
            feedback.textContent = 'Saving...';
            feedback.className = 'profile-edit-feedback';

            try {
                const res = await fetch('/api/auth/me', {
                    method: 'PATCH',
                    credentials: 'include',
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Could not save changes.');

                window.currentUser = data.user;
                window.dispatchEvent(new CustomEvent('melodiax-auth-changed'));

                const userAvatarImg = document.getElementById('user-avatar');
                const userNameEl = document.getElementById('user-name');
                if (userAvatarImg) userAvatarImg.src = data.user.profilePicture;
                if (userNameEl) userNameEl.textContent = data.user.username;

                feedback.textContent = 'Saved!';
                feedback.className = 'profile-edit-feedback profile-edit-feedback-success';
                setTimeout(() => { openModal(); }, 700); // card view par wapas, updated info ke sath
            } catch (err) {
                feedback.textContent = err.message;
                feedback.className = 'profile-edit-feedback profile-edit-feedback-error';
            } finally {
                saveBtn.disabled = false;
            }
        });
    }
})();
