let currentView = 'grid';
let resetToken = null;

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            loadFiles();
            loadUserProfile();
        }
    } catch(e) { console.error(e); }
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
            document.getElementById('userEmail').textContent = email;
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
        showMessage('authMessage', 'Password at least 6 characters', 'error');
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
    } catch(e) { console.error(e); }
}

function openProfileModal() {
    const modal = document.getElementById('profileModal');
    const modalPic = document.getElementById('modalProfilePic');
    const nameInput = document.getElementById('profileNameInput');
    if (window.currentProfile) {
        modalPic.src = window.currentProfile.profile_picture || '/uploads/default-avatar.png';
        nameInput.value = window.currentProfile.name || '';
    }
    document.getElementById('profileOldPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileMessage').innerHTML = '';
    modal.style.display = 'flex';
}
function closeProfileModal() { document.getElementById('profileModal').style.display = 'none'; }
async function updateProfileName() {
    const newName = document.getElementById('profileNameInput').value.trim();
    if (!newName) { showProfileMessage('Name required', 'error'); return; }
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
    } else showProfileMessage('Update failed', 'error');
}
async function updateProfilePassword() {
    const oldPass = document.getElementById('profileOldPassword').value;
    const newPass = document.getElementById('profileNewPassword').value;
    if (!oldPass || !newPass) { showProfileMessage('Fill both', 'error'); return; }
    if (newPass.length < 6) { showProfileMessage('Too short', 'error'); return; }
    const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: oldPass, newPassword: newPass })
    });
    if (res.ok) {
        showProfileMessage('Password changed!', 'success');
        setTimeout(() => closeProfileModal(), 1000);
    } else showProfileMessage('Wrong current password', 'error');
}
async function uploadProfilePicture(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('profile_pic', file);
    const res = await fetch('/api/auth/profile/picture', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
        showProfileMessage('Picture updated!', 'success');
        document.getElementById('profileAvatar').src = data.profile_picture + '?t=' + Date.now();
        document.getElementById('modalProfilePic').src = data.profile_picture;
    } else showProfileMessage('Upload failed', 'error');
    input.value = '';
}
function showProfileMessage(msg, type) {
    const el = document.getElementById('profileMessage');
    el.innerHTML = msg;
    el.className = `message ${type}`;
    setTimeout(() => { if (el.innerHTML === msg) el.innerHTML = ''; }, 3000);
}

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
    if (!curr || !newp) { showMessage('changePasswordMessage', 'Fill all fields', 'error'); return; }
    if (newp.length < 6) { showMessage('changePasswordMessage', 'Too short', 'error'); return; }
    const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curr, newPassword: newp })
    });
    const data = await res.json();
    if (res.ok) {
        showMessage('changePasswordMessage', 'Password changed!', 'success');
        setTimeout(closeChangePasswordModal, 2000);
    } else showMessage('changePasswordMessage', data.error, 'error');
}

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
            } else alert('Upload failed: ' + response.error);
        } else alert('Upload failed');
    };
    xhr.onerror = () => { progressContainer.style.display = 'none'; alert('Upload error'); };
    xhr.open('POST', '/api/files/upload', true);
    xhr.send(formData);
    input.value = '';
}

async function loadFiles() {
    try {
        const res = await fetch('/api/files/list');
        if (res.ok) {
            const files = await res.json();
            displayFiles(files);
        }
    } catch(e) { console.error(e); }
}
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
function formatDateTime(isoString) {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleString();
}
function escapeHtml(str) {
    return str.replace(/[&<>]/g, m => m==='&'?'&amp;':m==='<'?'&lt;':m==='>'?'&gt;':m);
}
function getFileIcon(mime, id, name) {
    if (mime && mime.startsWith('image/')) return `<img src="/api/files/preview/${id}" style="width:48px; height:48px; object-fit:cover; border-radius:8px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-file-image\\' style=\\'font-size:48px; color:#10b981\\'></i>';">`;
    if (mime.includes('pdf')) return '<i class="fas fa-file-pdf" style="color:#ef4444; font-size:48px;"></i>';
    if (mime.includes('video')) return '<i class="fas fa-file-video" style="color:#8b5cf6; font-size:48px;"></i>';
    if (mime.includes('audio')) return '<i class="fas fa-file-audio" style="color:#f59e0b; font-size:48px;"></i>';
    if (mime.includes('word')) return '<i class="fas fa-file-word" style="color:#3b82f6; font-size:48px;"></i>';
    if (mime.includes('excel')) return '<i class="fas fa-file-excel" style="color:#10b981; font-size:48px;"></i>';
    if (mime.includes('powerpoint')) return '<i class="fas fa-file-powerpoint" style="color:#ef4444; font-size:48px;"></i>';
    return '<i class="fas fa-file" style="color:#6b7280; font-size:48px;"></i>';
}
function displayFiles(files) {
    const container = document.getElementById('fileList');
    if (files.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fas fa-cloud-upload-alt" style="font-size:48px;"></i><p>No files yet.</p></div>';
        return;
    }
    if (currentView === 'grid') {
        container.innerHTML = files.map(f => `
            <div class="file-card">
                <div class="file-icon">${getFileIcon(f.type, f.id, f.name)}</div>
                <div class="file-name">${escapeHtml(f.name).substring(0,20)}</div>
                <div class="file-size">${formatFileSize(f.size)}</div>
                <div class="file-date">📅 ${formatDateTime(f.uploaded_at)}</div>
                <div class="file-actions">
                    <button onclick="previewFile(${f.id},'${escapeHtml(f.name)}','${f.type}')"><i class="fas fa-eye"></i></button>
                    <button onclick="downloadFile(${f.id})"><i class="fas fa-download"></i></button>
                    <button onclick="deleteFile(${f.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
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
                    <button class="icon-btn" onclick="previewFile(${f.id},'${escapeHtml(f.name)}','${f.type}')"><i class="fas fa-eye"></i></button>
                    <button class="icon-btn" onclick="downloadFile(${f.id})"><i class="fas fa-download"></i></button>
                    <button class="icon-btn" onclick="deleteFile(${f.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
    }
}
async function previewFile(id, name, type) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewFileName');
    const content = document.getElementById('previewContent');
    title.innerText = `Preview: ${name}`;
    content.innerHTML = 'Loading...';
    modal.style.display = 'flex';
    try {
        const res = await fetch(`/api/files/preview/${id}`);
        if (!res.ok) throw new Error('Preview failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (type.startsWith('image/')) content.innerHTML = `<img src="${url}" style="max-width:100%; max-height:70vh;">`;
        else if (type.startsWith('video/')) content.innerHTML = `<video controls autoplay style="max-width:100%;"><source src="${url}" type="${type}"></video>`;
        else if (type === 'application/pdf') content.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh;"></iframe>`;
        else if (type.startsWith('text/') || name.match(/\.(txt|js|json|html|css)$/i)) {
            const text = await blob.text();
            content.innerHTML = `<pre style="background:rgba(0,0,0,0.4); padding:10px;">${escapeHtml(text)}</pre>`;
        } else content.innerHTML = `<p>Preview not available. <button onclick="downloadFile(${id})">Download</button></p>`;
        content.dataset.blobUrl = url;
    } catch(e) { content.innerHTML = '<p>Error loading preview</p>'; }
}
function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    const content = document.getElementById('previewContent');
    if (content.dataset && content.dataset.blobUrl) URL.revokeObjectURL(content.dataset.blobUrl);
    modal.style.display = 'none';
    content.innerHTML = '';
}
function downloadFile(id) { window.open(`/api/files/download/${id}`, '_blank'); }
async function deleteFile(id) {
    if (confirm('Move to trash?')) {
        const res = await fetch(`/api/files/delete/${id}`, { method: 'DELETE' });
        if (res.ok) { alert('Moved to trash'); loadFiles(); }
        else alert('Failed');
    }
}
async function loadTrash() {
    const res = await fetch('/api/files/trash');
    if (res.ok) {
        const files = await res.json();
        const container = document.getElementById('trashList');
        if (files.length === 0) container.innerHTML = '<div><p>Trash empty</p></div>';
        else container.innerHTML = files.map(f => `
            <div class="trash-item">
                <div class="trash-info">${getFileIcon(f.type, f.id, f.name)}<div><div>${escapeHtml(f.name)}</div><div>${formatFileSize(f.size)} • Deleted: ${formatDateTime(f.deleted_at)}</div></div></div>
                <div class="trash-actions"><button onclick="restoreFile(${f.id})" class="icon-btn">Restore</button><button onclick="permanentDeleteFile(${f.id})" class="icon-btn delete-btn">Permanent</button></div>
            </div>`).join('');
    }
}
async function restoreFile(id) {
    const res = await fetch(`/api/files/restore/${id}`, { method: 'POST' });
    if (res.ok) { alert('Restored'); loadTrash(); loadFiles(); }
    else alert('Restore failed');
}
async function permanentDeleteFile(id) {
    if (confirm('Permanently delete?')) {
        const res = await fetch(`/api/files/permanent/${id}`, { method: 'DELETE' });
        if (res.ok) { alert('Deleted permanently'); loadTrash(); }
        else alert('Failed');
    }
}
function showTrashView() { document.getElementById('trashModal').style.display = 'flex'; loadTrash(); }
function closeTrashModal() { document.getElementById('trashModal').style.display = 'none'; }
function setView(view) {
    currentView = view;
    const container = document.getElementById('fileList');
    const g = document.querySelector('.view-btn:first-child');
    const l = document.querySelector('.view-btn:nth-child(2)');
    if (view === 'grid') { container.classList.remove('list-view'); container.classList.add('grid-view'); g.classList.add('active'); l.classList.remove('active'); }
    else { container.classList.remove('grid-view'); container.classList.add('list-view'); g.classList.remove('active'); l.classList.add('active'); }
    loadFiles();
}
function showMessage(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = msg;
    el.className = `message ${type}`;
    setTimeout(() => { if (el.innerHTML === msg) el.innerHTML = ''; }, 5000);
}

const themes = [
    { bg: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', accent: '#00d4ff', btnStart: '#00b4db', btnEnd: '#0083b0' },
    { bg: 'linear-gradient(135deg, #2b0b1a 0%, #8a2b3c 50%, #ff6b4a 100%)', accent: '#ff9a56', btnStart: '#ff8c42', btnEnd: '#d65c2c' },
];
let ti = 0;
function applyTheme(t) {
    document.documentElement.style.setProperty('--bg-gradient', t.bg);
    document.documentElement.style.setProperty('--accent-color', t.accent);
    document.documentElement.style.setProperty('--btn-start', t.btnStart);
    document.documentElement.style.setProperty('--btn-end', t.btnEnd);
    document.body.style.background = t.bg;
}
setInterval(() => { ti = (ti+1)%themes.length; applyTheme(themes[ti]); }, 5000);
applyTheme(themes[0]);
function createCloud() {
    const cloud = document.createElement('div');
    cloud.classList.add('cloud');
    cloud.style.width = Math.random()*150+50+'px';
    cloud.style.height = cloud.style.width*0.6;
    cloud.style.left = Math.random()*100+'%';
    cloud.style.top = Math.random()*80+'%';
    cloud.style.animationDuration = Math.random()*15+10+'s';
    cloud.style.opacity = Math.random()*0.4+0.2;
    document.querySelector('.bg-animation').appendChild(cloud);
    setTimeout(() => cloud.remove(), 20000);
}
function createParticle() {
    const p = document.createElement('div');
    p.classList.add('particle');
    p.style.width = Math.random()*8+3+'px';
    p.style.height = p.style.width;
    p.style.left = Math.random()*100+'%';
    p.style.animationDuration = Math.random()*8+4+'s';
    p.style.animationDelay = Math.random()*5+'s';
    p.style.background = `rgba(0,212,255,${Math.random()*0.5+0.2})`;
    document.querySelector('.bg-animation').appendChild(p);
    setTimeout(() => p.remove(), 10000);
}
setInterval(() => { if (Math.random()>0.7) createCloud(); if (Math.random()>0.5) createParticle(); }, 2000);

checkAuth();