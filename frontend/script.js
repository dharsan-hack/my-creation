/* ==========================================================================
   EVENT STORAGER - Client Application Logic with Authentication & CRUD
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let state = {
        events: [],
        token: localStorage.getItem('event_vault_token') || null,
        currentUser: JSON.parse(localStorage.getItem('event_vault_user')) || null,
        activeCategory: 'All',
        searchQuery: '',
        viewMode: 'grid', // 'grid' or 'list'
        activeLightboxEvent: null,
        selectedFile: null,
        editSelectedFile: null
    };

    // --- DOM Elements ---
    const eventsGrid = document.getElementById('events-grid');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');

    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const categoryContainer = document.getElementById('category-filter-container');
    const resultsCountText = document.getElementById('results-count-text');

    const viewGridBtn = document.getElementById('view-grid-btn');
    const viewListBtn = document.getElementById('view-list-btn');

    // Stats
    const statTotalEvents = document.getElementById('stat-total-events');
    const statMediaFiles = document.getElementById('stat-media-files');
    const statTotalLikes = document.getElementById('stat-total-likes');
    const statCategories = document.getElementById('stat-categories');

    // Auth Header Controls
    const authGuestControls = document.getElementById('auth-guest-controls');
    const authUserControls = document.getElementById('auth-user-controls');
    const openLoginBtn = document.getElementById('open-login-btn');
    const openRegisterBtn = document.getElementById('open-register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const headerUserName = document.getElementById('header-user-name');
    const userAvatarInitials = document.getElementById('user-avatar-initials');

    // Auth Modal & Forms
    const authModal = document.getElementById('auth-modal');
    const closeAuthModalBtn = document.getElementById('close-auth-modal-btn');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authErrorAlert = document.getElementById('auth-error-alert');
    const authSuccessAlert = document.getElementById('auth-success-alert');

    // Upload Modal & Form
    const uploadModal = document.getElementById('upload-modal');
    const openUploadBtn = document.getElementById('open-upload-modal-btn');
    const authUploadBtn = document.getElementById('auth-upload-btn');
    const closeUploadBtn = document.getElementById('close-upload-modal-btn');
    const cancelUploadBtn = document.getElementById('cancel-upload-btn');
    const emptyUploadBtn = document.getElementById('empty-upload-btn');
    const uploadForm = document.getElementById('event-upload-form');

    // Drag & Drop for Upload
    const dropZone = document.getElementById('drop-zone');
    const dropZoneContent = document.getElementById('drop-zone-content');
    const mediaFileInput = document.getElementById('media-file-input');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const previewMediaBox = document.getElementById('preview-media-box');
    const previewFilename = document.getElementById('preview-filename');
    const previewFilesize = document.getElementById('preview-filesize');
    const removeFileBtn = document.getElementById('remove-file-btn');

    // Edit Event Modal & Form
    const editModal = document.getElementById('edit-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editForm = document.getElementById('event-edit-form');
    const editDropZone = document.getElementById('edit-drop-zone');
    const editDropZoneContent = document.getElementById('edit-drop-zone-content');
    const editMediaFileInput = document.getElementById('edit-media-file-input');
    const editFilePreviewContainer = document.getElementById('edit-file-preview-container');
    const editPreviewMediaBox = document.getElementById('edit-preview-media-box');
    const editPreviewFilename = document.getElementById('edit-preview-filename');
    const editPreviewFilesize = document.getElementById('edit-preview-filesize');
    const editRemoveFileBtn = document.getElementById('edit-remove-file-btn');

    // Lightbox
    const lightboxModal = document.getElementById('lightbox-modal');
    const closeLightboxBtn = document.getElementById('close-lightbox-btn');
    const lbMediaWrapper = document.getElementById('lightbox-media-wrapper');
    const lbCategory = document.getElementById('lb-category');
    const lbAuthorName = document.getElementById('lb-author-name');
    const lbTitle = document.getElementById('lb-title');
    const lbDate = document.getElementById('lb-date');
    const lbLocation = document.getElementById('lb-location');
    const lbDescription = document.getElementById('lb-description');
    const lbTags = document.getElementById('lb-tags');
    const lbLikeBtn = document.getElementById('lb-like-btn');
    const lbLikeCount = document.getElementById('lb-like-count');
    const lbDownloadBtn = document.getElementById('lb-download-btn');
    const lbEditBtn = document.getElementById('lb-edit-btn');
    const lbDeleteBtn = document.getElementById('lb-delete-btn');

    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // --- Initialization ---
    init();

    function init() {
        updateAuthUI();
        verifyTokenOnLoad();
        fetchEvents();
        setupEventListeners();
    }

    // --- Helper for Auth Headers ---
    function getAuthHeaders(includeContentTypeJson = false) {
        const headers = {};
        if (includeContentTypeJson) {
            headers['Content-Type'] = 'application/json';
        }
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }
        return headers;
    }

    // --- Auth Management ---
    function updateAuthUI() {
        if (state.token && state.currentUser) {
            authGuestControls.classList.add('hidden');
            authUserControls.classList.remove('hidden');
            headerUserName.textContent = state.currentUser.username || 'Member';
            userAvatarInitials.textContent = (state.currentUser.username || 'U').charAt(0).toUpperCase();
        } else {
            authGuestControls.classList.remove('hidden');
            authUserControls.classList.add('hidden');
        }
    }

    async function verifyTokenOnLoad() {
        if (!state.token) return;
        try {
            const response = await fetch('/api/auth/me', {
                headers: getAuthHeaders(true)
            });
            if (!response.ok) {
                logout(false);
            }
        } catch (err) {
            console.warn('Auth token check failed:', err);
        }
    }

    function openAuthModal(tab = 'login') {
        clearAuthAlerts();
        authModal.classList.remove('hidden');
        switchAuthTab(tab);
    }

    function closeAuthModal() {
        authModal.classList.add('hidden');
        loginForm.reset();
        registerForm.reset();
        clearAuthAlerts();
    }

    function switchAuthTab(tab) {
        clearAuthAlerts();
        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        }
    }

    function showAuthAlert(message, type = 'error') {
        if (type === 'error') {
            authErrorAlert.textContent = message;
            authErrorAlert.classList.remove('hidden');
            authSuccessAlert.classList.add('hidden');
        } else {
            authSuccessAlert.textContent = message;
            authSuccessAlert.classList.remove('hidden');
            authErrorAlert.classList.add('hidden');
        }
    }

    function clearAuthAlerts() {
        authErrorAlert.classList.add('hidden');
        authSuccessAlert.classList.add('hidden');
    }

    async function handleLoginSubmit(e) {
        e.preventDefault();
        clearAuthAlerts();

        const account = document.getElementById('login-account').value.trim();
        const password = document.getElementById('login-password').value;

        if (!account || !password) {
            showAuthAlert('Please fill in both email/username and password.');
            return;
        }

        const submitBtn = document.getElementById('login-submit-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Logging in...`;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Login failed.');
            }

            state.token = data.token;
            state.currentUser = data.user;
            localStorage.setItem('event_vault_token', data.token);
            localStorage.setItem('event_vault_user', JSON.stringify(data.user));

            updateAuthUI();
            closeAuthModal();
            showToast(`Welcome back, ${data.user.username}!`, 'success');
        } catch (err) {
            showAuthAlert(err.message || 'Error authenticating user.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }

    async function handleRegisterSubmit(e) {
        e.preventDefault();
        clearAuthAlerts();

        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (!username || !email || !password) {
            showAuthAlert('Please fill in all registration fields.');
            return;
        }

        const submitBtn = document.getElementById('register-submit-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...`;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed.');
            }

            state.token = data.token;
            state.currentUser = data.user;
            localStorage.setItem('event_vault_token', data.token);
            localStorage.setItem('event_vault_user', JSON.stringify(data.user));

            updateAuthUI();
            closeAuthModal();
            showToast(`Account created! Welcome to Event Vault, ${data.user.username}!`, 'success');
        } catch (err) {
            showAuthAlert(err.message || 'Error creating account.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }

    function logout(showNotice = true) {
        state.token = null;
        state.currentUser = null;
        localStorage.removeItem('event_vault_token');
        localStorage.removeItem('event_vault_user');
        updateAuthUI();
        if (showNotice) {
            showToast('You have been logged out.', 'info');
        }
    }

    // --- API Calls for Events ---
    async function fetchEvents() {
        showLoading(true);
        try {
            const response = await fetch('/api/posts');
            if (!response.ok) throw new Error('Failed to load events');
            const data = await response.json();
            state.events = data.data || data || [];
            updateStats();
            renderEvents();
        } catch (error) {
            console.error('Error fetching events:', error);
            showToast('Could not fetch events from server', 'error');
            state.events = [];
            renderEvents();
        } finally {
            showLoading(false);
        }
    }

    async function handleEventSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('event-title').value.trim();
        const category = document.getElementById('event-category').value;
        const location = document.getElementById('event-location').value.trim();
        const description = document.getElementById('event-description').value.trim();
        const tags = document.getElementById('event-tags').value.trim();

        if (!title) {
            showToast('Event title is required', 'error');
            return;
        }

        if (!state.selectedFile && !mediaFileInput.files[0]) {
            showToast('Please select or drop a media file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('location', location);
        formData.append('description', description);
        formData.append('tags', tags);
        
        const fileToUpload = state.selectedFile || mediaFileInput.files[0];
        formData.append('file', fileToUpload);

        const submitBtn = document.getElementById('submit-event-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Storing Event...`;

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: getAuthHeaders(false),
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Upload failed');
            }

            showToast('Event memory successfully stored!', 'success');
            
            closeUploadModal();
            fetchEvents();
        } catch (err) {
            console.error('Upload Error:', err);
            showToast(err.message || 'Failed to upload event', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }

    async function handleEditSubmit(e) {
        e.preventDefault();

        const eventId = document.getElementById('edit-event-id').value;
        const title = document.getElementById('edit-event-title').value.trim();
        const category = document.getElementById('edit-event-category').value;
        const location = document.getElementById('edit-event-location').value.trim();
        const description = document.getElementById('edit-event-description').value.trim();
        const tags = document.getElementById('edit-event-tags').value.trim();

        if (!title) {
            showToast('Event title is required', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('location', location);
        formData.append('description', description);
        formData.append('tags', tags);

        const newFile = state.editSelectedFile || editMediaFileInput.files[0];
        if (newFile) {
            formData.append('file', newFile);
        }

        const submitBtn = document.getElementById('submit-edit-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving Changes...`;

        try {
            const response = await fetch(`/api/posts/${eventId}`, {
                method: 'PUT',
                headers: getAuthHeaders(false),
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update event details.');
            }

            showToast('Event memory updated successfully!', 'success');
            closeEditModal();
            if (state.activeLightboxEvent) {
                closeLightbox();
            }
            fetchEvents();
        } catch (err) {
            console.error('Edit Error:', err);
            showToast(err.message || 'Error updating event memory', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    }

    async function toggleLike(eventId) {
        try {
            const response = await fetch(`/api/posts/${eventId}/like`, { method: 'POST' });
            if (!response.ok) throw new Error('Failed to update like');
            const updated = await response.json();
            
            const target = state.events.find(ev => ev._id === eventId || ev.id === eventId);
            if (target) {
                target.likes = updated.likes !== undefined ? updated.likes : (target.likes + 1);
            }
            
            if (state.activeLightboxEvent && (state.activeLightboxEvent._id === eventId || state.activeLightboxEvent.id === eventId)) {
                state.activeLightboxEvent.likes = target.likes;
                lbLikeCount.textContent = target.likes;
            }

            updateStats();
            renderEvents();
        } catch (err) {
            showToast('Error updating like counter', 'error');
        }
    }

    async function deleteEvent(eventId) {
        if (!confirm('Are you sure you want to delete this event memory? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/posts/${eventId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(true)
            });

            if (!response.ok) throw new Error('Failed to delete event');
            
            showToast('Event memory deleted', 'success');
            
            if (state.activeLightboxEvent && (state.activeLightboxEvent._id === eventId || state.activeLightboxEvent.id === eventId)) {
                closeLightbox();
            }

            fetchEvents();
        } catch (err) {
            showToast('Could not delete event', 'error');
        }
    }

    // --- Render Functions ---
    function renderEvents() {
        let filtered = state.events;

        if (state.activeCategory !== 'All') {
            filtered = filtered.filter(ev => (ev.category || 'Other').toLowerCase() === state.activeCategory.toLowerCase());
        }

        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            filtered = filtered.filter(ev => {
                const titleMatch = (ev.title || '').toLowerCase().includes(q);
                const descMatch = (ev.description || '').toLowerCase().includes(q);
                const locMatch = (ev.location || '').toLowerCase().includes(q);
                const tagMatch = Array.isArray(ev.tags) ? ev.tags.some(t => t.toLowerCase().includes(q)) : (ev.tags || '').toLowerCase().includes(q);
                return titleMatch || descMatch || locMatch || tagMatch;
            });
        }

        resultsCountText.textContent = `Showing ${filtered.length} event${filtered.length === 1 ? '' : 's'}`;

        if (filtered.length === 0) {
            eventsGrid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        eventsGrid.className = `events-grid ${state.viewMode === 'list' ? 'list-view' : ''}`;
        
        eventsGrid.innerHTML = filtered.map(ev => createEventCardHTML(ev)).join('');

        document.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-like-badge')) return;
                const eventId = card.dataset.id;
                const eventObj = state.events.find(x => (x._id === eventId || x.id === eventId));
                if (eventObj) openLightbox(eventObj);
            });
        });

        document.querySelectorAll('.card-like-badge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = btn.dataset.id;
                toggleLike(eventId);
            });
        });
    }

    function createEventCardHTML(ev) {
        const id = ev._id || ev.id;
        const fileUrl = ev.fileUrl || ev.imageUrl || '#';
        const fileType = ev.fileType || detectFileType(fileUrl);
        const dateFormatted = ev.createdAt ? new Date(ev.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
        
        let mediaSnippet = '';
        if (fileType === 'image') {
            mediaSnippet = `<img src="${fileUrl}" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=60'">`;
        } else if (fileType === 'video') {
            mediaSnippet = `<video src="${fileUrl}" muted preload="metadata"></video><div class="media-placeholder-icon"><i class="fa-solid fa-circle-play"></i></div>`;
        } else if (fileType === 'audio') {
            mediaSnippet = `<div class="media-placeholder-icon"><i class="fa-solid fa-file-audio"></i></div>`;
        } else {
            mediaSnippet = `<div class="media-placeholder-icon"><i class="fa-solid fa-file-lines"></i></div>`;
        }

        const tagsArray = Array.isArray(ev.tags) ? ev.tags : (ev.tags ? ev.tags.split(',').map(t => t.trim()) : []);
        const tagsHtml = tagsArray.slice(0, 3).map(t => `<span class="tag-badge">#${escapeHtml(t)}</span>`).join('');

        return `
            <div class="event-card" data-id="${id}">
                <div class="event-card-media">
                    ${mediaSnippet}
                    <span class="card-category-badge"><i class="fa-solid fa-tag"></i> ${escapeHtml(ev.category || 'General')}</span>
                    <div class="card-like-badge" data-id="${id}" title="Like this memory">
                        <i class="fa-solid fa-heart"></i>
                        <span>${ev.likes || 0}</span>
                    </div>
                </div>
                <div class="event-card-body">
                    <h3 class="event-card-title">${escapeHtml(ev.title)}</h3>
                    <div class="event-card-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${dateFormatted}</span>
                        ${ev.location ? `<span>&bull; <i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.location)}</span>` : ''}
                    </div>
                    <p class="event-card-description">${escapeHtml(ev.description || 'No detailed notes provided.')}</p>
                    ${tagsHtml ? `<div class="event-card-tags">${tagsHtml}</div>` : ''}
                </div>
            </div>
        `;
    }

    function updateStats() {
        const totalEvents = state.events.length;
        const totalLikes = state.events.reduce((sum, ev) => sum + (ev.likes || 0), 0);
        const categoriesSet = new Set(state.events.map(ev => ev.category || 'Other'));

        statTotalEvents.textContent = totalEvents;
        statMediaFiles.textContent = totalEvents;
        statTotalLikes.textContent = totalLikes;
        statCategories.textContent = categoriesSet.size;
    }

    // --- Lightbox Handler ---
    function openLightbox(eventObj) {
        state.activeLightboxEvent = eventObj;
        const id = eventObj._id || eventObj.id;
        const fileUrl = eventObj.fileUrl || eventObj.imageUrl || '';
        const fileType = eventObj.fileType || detectFileType(fileUrl);
        
        lbCategory.textContent = eventObj.category || 'General';
        lbAuthorName.textContent = eventObj.user && eventObj.user.username ? eventObj.user.username : (eventObj.userName || 'Vault Creator');
        lbTitle.textContent = eventObj.title;
        lbDate.textContent = eventObj.createdAt ? new Date(eventObj.createdAt).toLocaleDateString() : 'Date N/A';
        lbLocation.textContent = eventObj.location || 'Location Not Specified';
        lbDescription.textContent = eventObj.description || 'No description provided for this stored event.';
        lbLikeCount.textContent = eventObj.likes || 0;

        const tagsArray = Array.isArray(eventObj.tags) ? eventObj.tags : (eventObj.tags ? eventObj.tags.split(',') : []);
        lbTags.innerHTML = tagsArray.map(t => `<span class="tag-badge">#${escapeHtml(t.trim())}</span>`).join(' ');

        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            lbDownloadBtn.href = fileUrl;
            lbDownloadBtn.target = '_blank';
            lbDownloadBtn.rel = 'noopener noreferrer';
            lbDownloadBtn.removeAttribute('download');
        } else {
            lbDownloadBtn.href = fileUrl;
            lbDownloadBtn.target = '_self';
            lbDownloadBtn.setAttribute('download', `${(eventObj.title || 'event').replace(/\s+/g, '_')}_media`);
        }

        lbMediaWrapper.innerHTML = '';
        if (fileType === 'image') {
            lbMediaWrapper.innerHTML = `<img src="${fileUrl}" alt="${escapeHtml(eventObj.title)}">`;
        } else if (fileType === 'video') {
            lbMediaWrapper.innerHTML = `<video src="${fileUrl}" controls autoplay style="width:100%; height:100%;"></video>`;
        } else if (fileType === 'audio') {
            lbMediaWrapper.innerHTML = `<div style="text-align:center;"><i class="fa-solid fa-music" style="font-size:4rem; color:var(--accent-primary); margin-bottom:1rem;"></i><br><audio src="${fileUrl}" controls autoplay></audio></div>`;
        } else {
            lbMediaWrapper.innerHTML = `<div style="text-align:center; color:var(--text-muted);"><i class="fa-solid fa-file-pdf" style="font-size:4rem; margin-bottom:1rem;"></i><p>Document Asset</p><a href="${fileUrl}" target="_blank" class="btn btn-secondary mt-4">Open File</a></div>`;
        }

        lbLikeBtn.onclick = () => toggleLike(id);
        lbEditBtn.onclick = () => openEditModal(eventObj);
        lbDeleteBtn.onclick = () => deleteEvent(id);

        lightboxModal.classList.remove('hidden');
    }

    function closeLightbox() {
        lightboxModal.classList.add('hidden');
        lbMediaWrapper.innerHTML = '';
        state.activeLightboxEvent = null;
    }

    // --- Drag & Drop for Upload & Edit ---
    function setupDragAndDrop() {
        // Upload Drop Zone
        dropZone.addEventListener('click', () => mediaFileInput.click());

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                handleFileSelection(files[0]);
            }
        });

        mediaFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelection(e.target.files[0]);
            }
        });

        removeFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetFileSelection();
        });

        // Edit Drop Zone
        editDropZone.addEventListener('click', () => editMediaFileInput.click());

        ['dragenter', 'dragover'].forEach(eventName => {
            editDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                editDropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            editDropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                editDropZone.classList.remove('dragover');
            }, false);
        });

        editDropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                handleEditFileSelection(files[0]);
            }
        });

        editMediaFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleEditFileSelection(e.target.files[0]);
            }
        });

        editRemoveFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetEditFileSelection();
        });
    }

    function handleFileSelection(file) {
        state.selectedFile = file;
        dropZoneContent.classList.add('hidden');
        filePreviewContainer.classList.remove('hidden');

        previewFilename.textContent = file.name;
        previewFilesize.textContent = formatBytes(file.size);

        previewMediaBox.innerHTML = '';
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            previewMediaBox.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            previewMediaBox.innerHTML = '<i class="fa-solid fa-film" style="font-size:1.5rem; color:#fff;"></i>';
        } else if (file.type.startsWith('audio/')) {
            previewMediaBox.innerHTML = '<i class="fa-solid fa-music" style="font-size:1.5rem; color:#fff;"></i>';
        } else {
            previewMediaBox.innerHTML = '<i class="fa-solid fa-file" style="font-size:1.5rem; color:#fff;"></i>';
        }
    }

    function resetFileSelection() {
        state.selectedFile = null;
        mediaFileInput.value = '';
        filePreviewContainer.classList.add('hidden');
        dropZoneContent.classList.remove('hidden');
    }

    function handleEditFileSelection(file) {
        state.editSelectedFile = file;
        editDropZoneContent.classList.add('hidden');
        editFilePreviewContainer.classList.remove('hidden');

        editPreviewFilename.textContent = file.name;
        editPreviewFilesize.textContent = formatBytes(file.size);

        editPreviewMediaBox.innerHTML = '';
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            editPreviewMediaBox.appendChild(img);
        } else {
            editPreviewMediaBox.innerHTML = '<i class="fa-solid fa-file-export" style="font-size:1.5rem; color:#fff;"></i>';
        }
    }

    function resetEditFileSelection() {
        state.editSelectedFile = null;
        editMediaFileInput.value = '';
        editFilePreviewContainer.classList.add('hidden');
        editDropZoneContent.classList.remove('hidden');
    }

    // --- Modal Controls ---
    function openUploadModal() {
        resetFileSelection();
        uploadForm.reset();
        uploadModal.classList.remove('hidden');
    }

    function closeUploadModal() {
        uploadModal.classList.add('hidden');
        resetFileSelection();
        uploadForm.reset();
    }

    function openEditModal(eventObj) {
        const id = eventObj._id || eventObj.id;
        document.getElementById('edit-event-id').value = id;
        document.getElementById('edit-event-title').value = eventObj.title || '';
        document.getElementById('edit-event-category').value = eventObj.category || 'Other';
        document.getElementById('edit-event-location').value = eventObj.location || '';
        document.getElementById('edit-event-description').value = eventObj.description || '';
        
        const tagsStr = Array.isArray(eventObj.tags) ? eventObj.tags.join(', ') : (eventObj.tags || '');
        document.getElementById('edit-event-tags').value = tagsStr;

        resetEditFileSelection();
        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
        resetEditFileSelection();
        editForm.reset();
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Auth Header Buttons
        openLoginBtn.addEventListener('click', () => openAuthModal('login'));
        openRegisterBtn.addEventListener('click', () => openAuthModal('register'));
        logoutBtn.addEventListener('click', () => logout(true));

        // Auth Tabs & Modal
        tabLogin.addEventListener('click', () => switchAuthTab('login'));
        tabRegister.addEventListener('click', () => switchAuthTab('register'));
        closeAuthModalBtn.addEventListener('click', closeAuthModal);
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });

        loginForm.addEventListener('submit', handleLoginSubmit);
        registerForm.addEventListener('submit', handleRegisterSubmit);

        // Upload Modal Open/Close
        openUploadBtn.addEventListener('click', openUploadModal);
        if (authUploadBtn) authUploadBtn.addEventListener('click', openUploadModal);
        closeUploadBtn.addEventListener('click', closeUploadModal);
        cancelUploadBtn.addEventListener('click', closeUploadModal);
        emptyUploadBtn.addEventListener('click', openUploadModal);
        uploadForm.addEventListener('submit', handleEventSubmit);

        // Edit Modal Open/Close
        closeEditModalBtn.addEventListener('click', closeEditModal);
        cancelEditBtn.addEventListener('click', closeEditModal);
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });
        editForm.addEventListener('submit', handleEditSubmit);

        // Lightbox Close
        closeLightboxBtn.addEventListener('click', closeLightbox);
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) closeLightbox();
        });

        setupDragAndDrop();

        // Search Input Handling with Debounce
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.trim();
            if (state.searchQuery) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(renderEvents, 250);
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.searchQuery = '';
            clearSearchBtn.classList.add('hidden');
            renderEvents();
        });

        // Category Filter Buttons
        categoryContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.pill-btn');
            if (!pill) return;
            
            document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active'));
            pill.classList.add('active');
            
            state.activeCategory = pill.dataset.category;
            renderEvents();
        });

        // View Mode Toggle
        viewGridBtn.addEventListener('click', () => {
            state.viewMode = 'grid';
            viewGridBtn.classList.add('active');
            viewListBtn.classList.remove('active');
            renderEvents();
        });

        viewListBtn.addEventListener('click', () => {
            state.viewMode = 'list';
            viewListBtn.classList.add('active');
            viewGridBtn.classList.remove('active');
            renderEvents();
        });
    }

    // --- Helper Utilities ---
    function showLoading(show) {
        if (show) {
            loadingState.classList.remove('hidden');
            eventsGrid.classList.add('hidden');
            emptyState.classList.add('hidden');
        } else {
            loadingState.classList.add('hidden');
            eventsGrid.classList.remove('hidden');
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = '<i class="fa-solid fa-circle-info"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
        if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';

        toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function detectFileType(url) {
        if (!url) return 'other';
        const cleanUrl = url.split('?')[0].toLowerCase();
        if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(cleanUrl) || cleanUrl.includes('unsplash.com')) return 'image';
        if (/\.(mp4|webm|ogg|mov)$/i.test(cleanUrl)) return 'video';
        if (/\.(mp3|wav|ogg|aac)$/i.test(cleanUrl)) return 'audio';
        return 'other';
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
