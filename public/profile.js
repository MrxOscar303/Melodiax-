// ============================================================
// Edit Profile modal - avatar (image) par click karte hi khulta hai.
// User apni profile picture, username, aur description (bio) badal sakta
// hai, aur apna @handle (username) yahan dekh sakta hai jo doston ko share
// karne ke kaam aata hai (Add Friend isi handle se hota hai).
// ============================================================
(function () {
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('profile-modal-close-btn');
    const avatarPreview = document.getElementById('profile-edit-avatar-preview');
    const avatarBtn = document.getElementById('profile-edit-avatar-btn');
    const avatarInput = document.getElementById('profile-edit-avatar-input');
    const handleText = document.getElementById('profile-handle-text');
    const usernameInput = document.getElementById('profile-edit-username');
    const bioInput = document.getElementById('profile-edit-bio');
    const feedback = document.getElementById('profile-edit-feedback');
    const saveBtn = document.getElementById('profile-edit-save-btn');
    const userAvatarBtn = document.getElementById('user-avatar');

    if (!modal || !userAvatarBtn) return;

    let selectedFile = null;

    function openModal() {
        if (!window.currentUser) return;
        avatarPreview.src = window.currentUser.profilePicture || '/uploads/avatars/default-avatar.png';
        handleText.textContent = '@' + window.currentUser.username;
        usernameInput.value = window.currentUser.username || '';
        bioInput.value = window.currentUser.bio || '';
        feedback.textContent = '';
        feedback.className = 'profile-edit-feedback';
        selectedFile = null;
        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // account dropdown ke hover-open se conflict na ho
        openModal();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (avatarBtn) {
        avatarBtn.addEventListener('click', () => avatarInput.click());
    }
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
                setTimeout(closeModal, 700);
            } catch (err) {
                feedback.textContent = err.message;
                feedback.className = 'profile-edit-feedback profile-edit-feedback-error';
            } finally {
                saveBtn.disabled = false;
            }
        });
    }
})();
