let currentView = 'grid';
let resetToken = null;

// Check URL for reset token
const urlParams = new URLSearchParams(window.location.search);
const tokenParam = urlParams.get('reset');
if (tokenParam) {
    resetToken = tokenParam;
    showResetPasswordModal();
    window.history.replaceState({}, document.title, window.location.pathname);
}

// ========== AUTH ==========
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            loadFiles();
        }
    } catch(e) { console.error(e); }
}

window.togglePassword = function(fieldId, icon) {
    const f = document.getElementById(fieldId);
    if (f.type === 'password') { f.type = 'text'; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
    else { f.type = 'password'; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
};

function showAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = document.querySelectorAll('.tab-btn');
    if (tab === 'login') { loginForm.classList.add('active'); signupForm.classList.remove('active'); tabs[0].classList.add('active'); tabs[1].classList.remove('active'); }
    else { loginForm.classList.remove('active'); signupForm.classList.add('active'); tabs[0].classList.remove('active'); tabs[1].classList.add('active'); }
    document.getElementById('authMessage').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const pwd = document.getElementById('signupPassword');
    const confirm = document.getElementById('signupConfirmPassword');
    const msg = document.getElementById('passwordMatchMsg');
    if (pwd && confirm) {
        function validate() {
            if (confirm.value.length) {
                if (pwd.value === confirm.value) { msg.innerHTML = '✓ Passwords match'; msg.style.color = '#86efac'; }
                else { msg.innerHTML = '✗ Passwords do not match'; msg.style.color = '#fca5a5'; }
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
        const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('userEmail').textContent = email;
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            loadFiles();
        } else showMessage('authMessage', data.error, 'error');
    } catch(err) { showMessage('authMessage', 'Network error - check server', 'error'); }
}

async function signup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirmPassword').value;
    if (password !== confirm) { showMessage('authMessage', 'Passwords do not match', 'error'); return; }
    if (password.length < 6) { showMessage('authMessage', 'Password min 6 chars', 'error'); return; }
    try {
        const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (res.ok) {
            showMessage('authMessage', 'Account created! Please login.', 'success');
            showAuthTab('login');
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupConfirmPassword').value = '';
        } else showMessage('authMessage', data.error, 'error');
    } catch(err) { showMessage('authMessage', 'Network error', 'error'); }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';
}

// ========== FILE UPLOAD & PROGRESS ==========
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
            } else alert('Upload failed: ' + (response.error || 'Unknown'));
        } else alert('Upload failed');
    };
    xhr.onerror = () => { progressContainer.style.display = 'none'; alert('Upload error'); };
    xhr.open('POST', '/api/files/upload', true);
    xhr.send(formData);
    input.value = '';
}

// ========== LOAD FILES & TRASH ==========
async function loadFiles() {
    try {
        const res = await fetch('/api/files/list');
        if (res.ok) {
            const files = await res.json();
            displayFiles(files);
        }
    } catch(e) { console.error(e); }
}

async function loadTrash() {
    try {
        const res = await fetch('/api/files/trash');
        if (res.ok) {
            const files = await res.json();
            displayTrash(files);
        }
    } catch(e) { console.error(e); }
}

function formatDateTime(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleString(); // local date + time
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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateName(name, maxLen) {
    return name.length > maxLen ? name.substring(0, maxLen - 3) + '...' : name;
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

// ========== FILE OPERATIONS ==========
async function previewFile(fileId, fileName, mimeType) {
    const modal = document.getElementById('previewModal');
    const titleElem = document.getElementById('previewFileName');
    const contentDiv = document.getElementById('previewContent');
    if (!modal || !titleElem || !contentDiv) {
        console.error('Preview modal missing');
        alert('Preview not available. Please refresh.');
        return;
    }
    titleElem.innerText = `Preview: ${fileName}`;
    contentDiv.innerHTML = '<div style="text-align:center; padding:20px;">Loading preview...</div>';
    modal.style.display = 'flex';
    try {
        const response = await fetch(`/api/files/preview/${fileId}`);
        if (!response.ok) throw new Error('Preview failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (mimeType.startsWith('image/')) {
            contentDiv.innerHTML = `<img src="${url}" alt="${fileName}" style="max-width:100%; max-height:70vh;">`;
        } else if (mimeType.startsWith('video/')) {
            contentDiv.innerHTML = `<video controls autoplay style="max-width:100%; max-height:70vh;"><source src="${url}" type="${mimeType}"></video>`;
        } else if (mimeType.startsWith('audio/')) {
            contentDiv.innerHTML = `<audio controls autoplay style="width:100%;"><source src="${url}" type="${mimeType}"></audio>`;
        } else if (mimeType === 'application/pdf') {
            contentDiv.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh;"></iframe>`;
        } else if (mimeType.startsWith('text/') || fileName.match(/\.(txt|js|json|html|css|md)$/i)) {
            const text = await blob.text();
            contentDiv.innerHTML = `<pre style="text-align:left; white-space:pre-wrap; color:white; background:rgba(0,0,0,0.4); padding:10px; border-radius:8px;">${escapeHtml(text)}</pre>`;
        } else {
            contentDiv.innerHTML = `<p style="color:white;">Preview not available for this file type.</p><button class="btn-primary" onclick="downloadFile(${fileId})">Download File</button>`;
        }
        contentDiv.dataset.blobUrl = url;
    } catch (err) {
        console.error(err);
        contentDiv.innerHTML = `<p style="color:red;">Error loading preview: ${err.message}</p>`;
    }
}

function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    const contentDiv = document.getElementById('previewContent');
    if (contentDiv && contentDiv.dataset && contentDiv.dataset.blobUrl) {
        URL.revokeObjectURL(contentDiv.dataset.blobUrl);
        delete contentDiv.dataset.blobUrl;
    }
    if (modal) modal.style.display = 'none';
    if (contentDiv) contentDiv.innerHTML = '';
}

function downloadFile(id) { window.open(`/api/files/download/${id}`, '_blank'); }

async function deleteFile(id) {
    if (confirm('Move this file to trash?')) {
        const res = await fetch(`/api/files/delete/${id}`, { method: 'DELETE' });
        if (res.ok) { alert('Moved to trash'); loadFiles(); }
        else alert('Failed to move to trash');
    }
}

async function restoreFile(id) {
    const res = await fetch(`/api/files/restore/${id}`, { method: 'POST' });
    if (res.ok) { alert('Restored'); loadTrash(); loadFiles(); }
    else alert('Restore failed');
}

async function permanentDeleteFile(id) {
    if (confirm('⚠️ Permanently delete this file? It cannot be undone.')) {
        const res = await fetch(`/api/files/permanent/${id}`, { method: 'DELETE' });
        if (res.ok) { alert('Permanently deleted'); loadTrash(); }
        else alert('Delete failed');
    }
}

// ========== UI HELPERS ==========
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

// Trash modal
function showTrashView() {
    document.getElementById('trashModal').style.display = 'flex';
    loadTrash();
}
function closeTrashModal() {
    document.getElementById('trashModal').style.display = 'none';
}

// Forgot / Reset password (keep as before but ensure functions exist)
function showForgotPassword() { document.getElementById('forgotModal').style.display = 'flex'; }
function closeForgotModal() { document.getElementById('forgotModal').style.display = 'none'; document.getElementById('forgotEmail').value = ''; document.getElementById('forgotMessage').innerHTML = ''; }
async function sendResetLink() {
    const email = document.getElementById('forgotEmail').value;
    if (!email) { showMessage('forgotMessage', 'Enter email', 'error'); return; }
    const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (res.ok) { showMessage('forgotMessage', data.message, 'success'); setTimeout(closeForgotModal, 3000); }
    else showMessage('forgotMessage', data.error, 'error');
}
function showResetPasswordModal() { document.getElementById('resetModal').style.display = 'flex'; }
function closeResetModal() { document.getElementById('resetModal').style.display = 'none'; resetToken = null; window.location.href = '/'; }
async function submitResetPassword() {
    const np = document.getElementById('resetNewPassword').value;
    const cp = document.getElementById('resetConfirmPassword').value;
    if (np !== cp) { showMessage('resetMessage', 'Passwords mismatch', 'error'); return; }
    if (np.length < 6) { showMessage('resetMessage', 'Too short', 'error'); return; }
    const res = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword: np }) });
    const data = await res.json();
    if (res.ok) { showMessage('resetMessage', 'Password reset!', 'success'); setTimeout(() => { closeResetModal(); window.location.href = '/'; }, 2000); }
    else showMessage('resetMessage', data.error, 'error');
}
function changePasswordDialog() { document.getElementById('changePasswordModal').style.display = 'flex'; }
function closeChangePasswordModal() { document.getElementById('changePasswordModal').style.display = 'none'; document.getElementById('currentPassword').value = ''; document.getElementById('newPassword').value = ''; document.getElementById('changePasswordMessage').innerHTML = ''; }
async function submitChangePassword() {
    const curr = document.getElementById('currentPassword').value;
    const newp = document.getElementById('newPassword').value;
    if (!curr || !newp) { showMessage('changePasswordMessage', 'Fill all fields', 'error'); return; }
    if (newp.length < 6) { showMessage('changePasswordMessage', 'Too short', 'error'); return; }
    const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: curr, newPassword: newp }) });
    const data = await res.json();
    if (res.ok) { showMessage('changePasswordMessage', 'Password changed!', 'success'); setTimeout(closeChangePasswordModal, 2000); }
    else showMessage('changePasswordMessage', data.error, 'error');
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) event.target.style.display = 'none';
};

// ========== THEMES & ANIMATIONS ==========
const themes = [
    { bg: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', accent: '#00d4ff', btnStart: '#00b4db', btnEnd: '#0083b0' },
    { bg: 'linear-gradient(135deg, #2b0b1a 0%, #8a2b3c 50%, #ff6b4a 100%)', accent: '#ff9a56', btnStart: '#ff8c42', btnEnd: '#d65c2c' },
    { bg: 'linear-gradient(135deg, #0a2a1a 0%, #1b5e2a 50%, #43a047 100%)', accent: '#a5d6a7', btnStart: '#66bb6a', btnEnd: '#2e7d32' }
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
setInterval(() => { if (Math.random() > 0.7) createCloud(); }, 3000);

checkAuth();