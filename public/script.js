let currentView = 'grid';

// ======================== AUTH & PAGE LOAD ========================
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            const userEmailSpan = document.getElementById('userEmail');
            if (userEmailSpan) userEmailSpan.textContent = user.email;
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            loadFiles();
            loadUserProfile();
        }
    } catch(e) { console.error('Auth check failed', e); }
}

window.togglePassword = function(fieldId, icon) {
    const f = document.getElementById(fieldId);
    if (f.type === 'password') {
        f.type = 'text';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        f.type = 'password';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
};

function showAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = document.querySelectorAll('.tab-btn');
    if (tab === 'login') {
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
    document.getElementById('authMessage').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const pwd = document.getElementById('signupPassword');
    const confirm = document.getElementById('signupConfirmPassword');
    const msg = document.getElementById('passwordMatchMsg');
    if (pwd && confirm) {
        function validate() {
            if (confirm.value.length) {
                if (pwd.value === confirm.value) {
                    msg.innerHTML = '✓ Passwords match';
                    msg.style.color = '#86efac';
                } else {
                    msg.innerHTML = '✗ Passwords do not match';
                    msg.style.color = '#fca5a5';
                }
            } else msg.innerHTML = '';
        }
        pwd.addEventListener('input', validate);
        confirm.addEventListener('input', validate);
    }
});

async function login(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (document.getElementById('userEmail')) document.getElementById('userEmail').textContent = email;
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            loadFiles();
            loadUserProfile();
        } else {
            showMessage('authMessage', data.error, 'error');
        }
    } catch(err) {
        showMessage('authMessage', 'Network error - is server running?', 'error');
    }
}

async function signup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirmPassword').value;
    if (password !== confirm) {
        showMessage('authMessage', 'Passwords do not match', 'error');
        return;
    }
    if (password.length < 6) {
        showMessage('authMessage', 'Password must be at least 6 characters', 'error');
        return;
    }
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('authMessage', 'Account created! Please login.', 'success');
            showAuthTab('login');
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupConfirmPassword').value = '';
        } else {
            showMessage('authMessage', data.error, 'error');
        }
    } catch(err) {
        showMessage('authMessage', 'Network error', 'error');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

// ======================== PROFILE ========================
async function loadUserProfile() {
    try {
        const res = await fetch('/api/auth/profile');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('userName').innerText = user.name || user.email.split('@')[0];
            const avatar = document.getElementById('profileAvatar');
            if (user.profile_picture && user.profile_picture !== '/uploads/default-avatar.png') {
                avatar.src = user.profile_picture + '?t=' + Date.now();
            } else {
                avatar.src = '/uploads/default-avatar.png';
            }
            window.currentProfile = user;
        }
    } catch(e) { console.error('Profile load failed', e); }
}

function openProfileModal() {
    const modal = document.getElementById('profileModal');
    const modalPic = document.getElementById('modalProfilePic');
    const nameInput = document.getElementById('profileNameInput');
    if (window.currentProfile) {
        modalPic.src = window.currentProfile.profile_picture || '/uploads/default-avatar.png';
        nameInput.value = window.currentProfile.name || '';
    } else {
        modalPic.src = '/uploads/default-avatar.png';
        nameInput.value = '';
    }
    document.getElementById('profileOldPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileMessage').innerHTML = '';
    modal.style.display = 'flex';
}
function closeProfileModal() { document.getElementById('profileModal').style.display = 'none'; }
function showProfileMessage(msg, type) {
    const el = document.getElementById('profileMessage');
    el.innerHTML = msg;
    el.className = `message ${type}`;
    setTimeout(() => { if (el.innerHTML === msg) el.innerHTML = ''; }, 3000);
}
async function updateProfileName() {
    const newName = document.getElementById('profileNameInput').value.trim();
    if (!newName) { showProfileMessage('Name cannot be empty', 'error'); return; }
    try {
        const res = await fetch('/api/auth/profile/name', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        if (res.ok) {
            showProfileMessage('Name updated!', 'success');
            document.getElementById('userName').innerText = newName;
            if (window.currentProfile) window.currentProfile.name = newName;
            setTimeout(() => closeProfileModal(), 1000);
        } else {
            const data = await res.json();
            showProfileMessage(data.error || 'Update failed', 'error');
        }
    } catch(err) { showProfileMessage('Network error', 'error'); }
}
async function updateProfilePassword() {
    const oldPass = document.getElementById('profileOldPassword').value;
    const newPass = document.getElementById('profileNewPassword').value;
    if (!oldPass || !newPass) { showProfileMessage('Fill both fields', 'error'); return; }
    if (newPass.length < 6) { showProfileMessage('Password too short', 'error'); return; }
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: oldPass, newPassword: newPass })
        });
        if (res.ok) {
            showProfileMessage('Password changed!', 'success');
            setTimeout(() => closeProfileModal(), 1000);
        } else {
            const data = await res.json();
            showProfileMessage(data.error || 'Wrong current password', 'error');
        }
    } catch(err) { showProfileMessage('Network error', 'error'); }
}
async function uploadProfilePicture(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('profile_pic', file);
    try {
        const res = await fetch('/api/auth/profile/picture', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            showProfileMessage('Picture updated!', 'success');
            const newSrc = data.profile_picture + '?t=' + Date.now();
            document.getElementById('profileAvatar').src = newSrc;
            document.getElementById('modalProfilePic').src = newSrc;
            if (window.currentProfile) window.currentProfile.profile_picture = data.profile_picture;
            setTimeout(() => closeProfileModal(), 1000);
        } else {
            showProfileMessage(data.error || 'Upload failed', 'error');
        }
    } catch(err) { showProfileMessage('Network error', 'error'); }
    input.value = '';
}

// ======================== CHANGE PASSWORD (STANDALONE) ========================
function changePasswordDialog() {
    document.getElementById('changePasswordModal').style.display = 'flex';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPasswordModal').value = '';
    document.getElementById('changePasswordMessage').innerHTML = '';
}
function closeChangePasswordModal() { document.getElementById('changePasswordModal').style.display = 'none'; }
async function submitChangePassword() {
    const curr = document.getElementById('currentPassword').value;
    const newp = document.getElementById('newPasswordModal').value;
    if (!curr || !newp) { showMessage('changePasswordMessage', 'Please fill all fields', 'error'); return; }
    if (newp.length < 6) { showMessage('changePasswordMessage', 'New password must be at least 6 characters', 'error'); return; }
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: curr, newPassword: newp })
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('changePasswordMessage', 'Password changed successfully!', 'success');
            setTimeout(() => closeChangePasswordModal(), 2000);
        } else {
            showMessage('changePasswordMessage', data.error, 'error');
        }
    } catch(err) {
        showMessage('changePasswordMessage', 'Network error', 'error');
    }
}

// ======================== FILE UPLOAD ========================
async function uploadFile(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPercent = document.getElementById('uploadProgressPercent');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressPercent.innerText = '0%';
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            progressPercent.innerText = percent + '%';
        }
    });
    xhr.onload = () => {
        progressContainer.style.display = 'none';
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                alert(`✅ Upload Complete!\n${file.name} (${formatFileSize(file.size)})`);
                loadFiles();
            } else {
                alert('Upload failed: ' + (response.error || 'Unknown error'));
            }
        } else {
            alert('Upload failed. Server error.');
        }
    };
    xhr.onerror = () => {
        progressContainer.style.display = 'none';
        alert('Upload failed. Network error.');
    };
    xhr.open('POST', '/api/files/upload', true);
    xhr.send(formData);
    input.value = '';
}

// ======================== LOAD & DISPLAY FILES ========================
async function loadFiles() {
    try {
        const res = await fetch('/api/files/list');
        if (res.ok) {
            const files = await res.json();
            displayFiles(files);
        }
    } catch(e) { console.error(e); }
}
function formatDateTime(isoString) {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleString();
}
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
function truncateName(name, maxLen) {
    return name.length > maxLen ? name.substring(0, maxLen-3) + '...' : name;
}
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
function getFileIcon(mimeType, fileId, fileName) {
    if (mimeType && mimeType.startsWith('image/')) {
        return `<img src="/api/files/preview/${fileId}" style="width:48px; height:48px; object-fit:cover; border-radius:8px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-file-image\\' style=\\'font-size:48px; color:#10b981\\'></i>';">`;
    }
    if (mimeType.includes('pdf')) return '<i class="fas fa-file-pdf" style="color:#ef4444; font-size:48px;"></i>';
    if (mimeType.includes('video')) return '<i class="fas fa-file-video" style="color:#8b5cf6; font-size:48px;"></i>';
    if (mimeType.includes('audio')) return '<i class="fas fa-file-audio" style="color:#f59e0b; font-size:48px;"></i>';
    if (mimeType.includes('word')) return '<i class="fas fa-file-word" style="color:#3b82f6; font-size:48px;"></i>';
    if (mimeType.includes('excel')) return '<i class="fas fa-file-excel" style="color:#10b981; font-size:48px;"></i>';
    if (mimeType.includes('powerpoint')) return '<i class="fas fa-file-powerpoint" style="color:#ef4444; font-size:48px;"></i>';
    return '<i class="fas fa-file" style="color:#6b7280; font-size:48px;"></i>';
}
function displayFiles(files) {
    const container = document.getElementById('fileList');
    if (files.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fas fa-cloud-upload-alt" style="font-size:48px;"></i><p>No files yet. Upload your first file!</p></div>';
        return;
    }
    if (currentView === 'grid') {
        container.innerHTML = files.map(f => `
            <div class="file-card">
                <div class="file-icon">${getFileIcon(f.type, f.id, f.name)}</div>
                <div class="file-name" title="${escapeHtml(f.name)}">${truncateName(f.name, 20)}</div>
                <div class="file-size">${formatFileSize(f.size)}</div>
                <div class="file-date">📅 ${formatDateTime(f.uploaded_at)}</div>
                <div class="file-actions">
                    <button onclick="previewFile(${f.id}, '${escapeHtml(f.name)}', '${f.type}')"><i class="fas fa-eye"></i></button>
                    <button onclick="downloadFile(${f.id})"><i class="fas fa-download"></i></button>
                    <button onclick="deleteFile(${f.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = files.map(f => `
            <div class="file-list-item">
                <div class="file-list-info">
                    <div style="width:48px;">${getFileIcon(f.type, f.id, f.name)}</div>
                    <div class="file-list-details">
                        <div class="file-list-name">${escapeHtml(f.name)}</div>
                        <div class="file-list-meta">${formatFileSize(f.size)} • 📅 ${formatDateTime(f.uploaded_at)}</div>
                    </div>
                </div>
                <div class="file-list-actions">
                    <button class="icon-btn" onclick="previewFile(${f.id}, '${escapeHtml(f.name)}', '${f.type}')"><i class="fas fa-eye"></i></button>
                    <button class="icon-btn" onclick="downloadFile(${f.id})"><i class="fas fa-download"></i></button>
                    <button class="icon-btn" onclick="deleteFile(${f.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }
}

// ======================== TRASH FUNCTIONS ========================
async function loadTrash() {
    try {
        const res = await fetch('/api/files/trash');
        if (res.ok) {
            const files = await res.json();
            displayTrash(files);
        }
    } catch(e) { console.error(e); }
}
function displayTrash(files) {
    const container = document.getElementById('trashList');
    if (files.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-trash-alt"></i><p>Trash is empty</p></div>';
        return;
    }
    container.innerHTML = files.map(f => `
        <div class="trash-item">
            <div class="trash-info">
                ${getFileIcon(f.type, f.id, f.name)}
                <div>
                    <div class="trash-name">${escapeHtml(f.name)}</div>
                    <div class="trash-meta">${formatFileSize(f.size)} • Deleted: ${formatDateTime(f.deleted_at)}</div>
                </div>
            </div>
            <div class="trash-actions">
                <button onclick="restoreFile(${f.id})" class="icon-btn"><i class="fas fa-trash-restore"></i> Restore</button>
                <button onclick="permanentDeleteFile(${f.id})" class="icon-btn delete-btn"><i class="fas fa-trash-alt"></i> Permanently</button>
            </div>
        </div>
    `).join('');
}
function showTrashView() { document.getElementById('trashModal').style.display = 'flex'; loadTrash(); }
function closeTrashModal() { document.getElementById('trashModal').style.display = 'none'; }
async function deleteFile(id) {
    if (confirm('Move this file to trash?')) {
        const res = await fetch(`/api/files/delete/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert('Moved to trash');
            loadFiles();
        } else {
            alert('Failed to move to trash');
        }
    }
}
async function restoreFile(id) {
    const res = await fetch(`/api/files/restore/${id}`, { method: 'POST' });
    if (res.ok) {
        alert('Restored');
        loadTrash();
        loadFiles();
    } else {
        alert('Restore failed');
    }
}
async function permanentDeleteFile(id) {
    if (confirm('⚠️ Permanently delete this file? It cannot be undone.')) {
        const res = await fetch(`/api/files/permanent/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert('Permanently deleted');
            loadTrash();
        } else {
            alert('Delete failed');
        }
    }
}

// ======================== PREVIEW & DOWNLOAD ========================
async function previewFile(id, name, type) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewFileName');
    const content = document.getElementById('previewContent');
    title.innerText = `Preview: ${name}`;
    content.innerHTML = '<div style="text-align:center; padding:20px;">Loading preview...</div>';
    modal.style.display = 'flex';
    try {
        const res = await fetch(`/api/files/preview/${id}`);
        if (!res.ok) throw new Error('Preview failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (type.startsWith('image/')) {
            content.innerHTML = `<img src="${url}" alt="${name}" style="max-width:100%; max-height:70vh;">`;
        } else if (type.startsWith('video/')) {
            content.innerHTML = `<video controls autoplay style="max-width:100%; max-height:70vh;"><source src="${url}" type="${type}"></video>`;
        } else if (type.startsWith('audio/')) {
            content.innerHTML = `<audio controls autoplay style="width:100%;"><source src="${url}" type="${type}"></audio>`;
        } else if (type === 'application/pdf') {
            content.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh;"></iframe>`;
        } else if (type.startsWith('text/') || name.match(/\.(txt|js|json|html|css|md)$/i)) {
            const text = await blob.text();
            content.innerHTML = `<pre style="text-align:left; white-space:pre-wrap; color:white; background:rgba(0,0,0,0.4); padding:10px; border-radius:8px;">${escapeHtml(text)}</pre>`;
        } else {
            content.innerHTML = `<p style="color:white;">Preview not available. <button class="btn-primary" onclick="downloadFile(${id})">Download File</button></p>`;
        }
        content.dataset.blobUrl = url;
    } catch(err) {
        console.error(err);
        content.innerHTML = `<p style="color:red;">Error loading preview: ${err.message}</p>`;
    }
}
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    const content = document.getElementById('previewContent');
    if (content.dataset && content.dataset.blobUrl) {
        URL.revokeObjectURL(content.dataset.blobUrl);
        delete content.dataset.blobUrl;
    }
    modal.style.display = 'none';
    content.innerHTML = '';
}
function downloadFile(id) { window.open(`/api/files/download/${id}`, '_blank'); }

// ======================== VIEW TOGGLE ========================
function setView(view) {
    currentView = view;
    const container = document.getElementById('fileList');
    const gridBtn = document.querySelector('.view-btn:first-child');
    const listBtn = document.querySelector('.view-btn:nth-child(2)');
    if (view === 'grid') {
        container.classList.remove('list-view');
        container.classList.add('grid-view');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else {
        container.classList.remove('grid-view');
        container.classList.add('list-view');
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
    }
    loadFiles();
}
function showMessage(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = msg;
    el.className = `message ${type}`;
    setTimeout(() => { if (el.innerHTML === msg) el.innerHTML = ''; }, 5000);
}

// ======================== DYNAMIC THEME & CLOUD ANIMATION ========================
const themes = [
    { bg: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', accent: '#00d4ff', btnStart: '#00b4db', btnEnd: '#0083b0' },
    { bg: 'linear-gradient(135deg, #2b0b1a 0%, #8a2b3c 50%, #ff6b4a 100%)', accent: '#ff9a56', btnStart: '#ff8c42', btnEnd: '#d65c2c' },
    { bg: 'linear-gradient(135deg, #0a2a1a 0%, #1b5e2a 50%, #43a047 100%)', accent: '#a5d6a7', btnStart: '#66bb6a', btnEnd: '#2e7d32' },
    { bg: 'linear-gradient(135deg, #1a0b2e 0%, #4a1d6d 50%, #9c27b0 100%)', accent: '#ce93d8', btnStart: '#ba68c8', btnEnd: '#7b1fa2' },
    { bg: 'linear-gradient(135deg, #0a0f2a 0%, #1a237e 50%, #283593 100%)', accent: '#64b5f6', btnStart: '#42a5f5', btnEnd: '#1565c0' }
];
let themeIndex = 0;
function applyTheme(t) {
    document.documentElement.style.setProperty('--bg-gradient', t.bg);
    document.documentElement.style.setProperty('--accent-color', t.accent);
    document.documentElement.style.setProperty('--btn-start', t.btnStart);
    document.documentElement.style.setProperty('--btn-end', t.btnEnd);
    document.body.style.background = t.bg;
}
function rotateTheme() {
    themeIndex = (themeIndex + 1) % themes.length;
    applyTheme(themes[themeIndex]);
}
setInterval(rotateTheme, 5000);
applyTheme(themes[0]);

function createCloud() {
    const cloud = document.createElement('div');
    cloud.classList.add('cloud');
    const size = Math.random() * 150 + 50;
    cloud.style.width = size + 'px';
    cloud.style.height = (size * 0.6) + 'px';
    cloud.style.left = Math.random() * 100 + '%';
    cloud.style.top = Math.random() * 80 + '%';
    cloud.style.animationDuration = Math.random() * 15 + 10 + 's';
    cloud.style.opacity = Math.random() * 0.4 + 0.2;
    document.querySelector('.bg-animation').appendChild(cloud);
    setTimeout(() => cloud.remove(), 20000);
}
function createParticle() {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    const size = Math.random() * 8 + 3;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = Math.random() * 8 + 4 + 's';
    particle.style.animationDelay = Math.random() * 5 + 's';
    particle.style.background = `rgba(0, 212, 255, ${Math.random() * 0.5 + 0.2})`;
    document.querySelector('.bg-animation').appendChild(particle);
    setTimeout(() => particle.remove(), 10000);
}
setInterval(() => {
    if (Math.random() > 0.7) createCloud();
    if (Math.random() > 0.5) createParticle();
}, 2000);

// ======================== INIT ========================
checkAuth();