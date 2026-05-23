let currentView = 'grid';

// ========== AUTH & PROFILE (keep existing functions) ==========
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

// ========== PROFILE FUNCTIONS (unchanged, copy from previous working version) ==========
// ... (keep your existing loadUserProfile, openProfileModal, updateProfileName, etc.)
// For brevity, I assume you already have them. If not, I can repost.

// ========== UPLOAD USING SIGNED URL (NEW) ==========
async function uploadFile(input) {
    const file = input.files[0];
    if (!file) return;

    // 1. Get signed upload URL from backend
    let signedUrl, publicUrl, filePath;
    try {
        const res = await fetch(`/api/files/upload-url?name=${encodeURIComponent(file.name)}`);
        if (!res.ok) throw new Error('Failed to get upload URL');
        const data = await res.json();
        signedUrl = data.signedUrl;
        publicUrl = data.publicUrl;
        filePath = data.filePath;
    } catch (err) {
        alert('Failed to prepare upload: ' + err.message);
        return;
    }

    // 2. Upload file directly to Supabase using PUT request
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
            // 3. Register file metadata in database
            fetch('/api/files/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    publicUrl: publicUrl,
                    filePath: filePath
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert(`✅ Upload Complete!\n${file.name} (${formatFileSize(file.size)})`);
                    loadFiles();
                } else {
                    alert('Upload succeeded but failed to save metadata: ' + data.error);
                }
            })
            .catch(err => alert('Metadata save error: ' + err.message));
        } else {
            alert('Upload failed. Status: ' + xhr.status);
        }
    };

    xhr.onerror = () => {
        progressContainer.style.display = 'none';
        alert('Upload failed. Network error.');
    };

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
    input.value = '';
}

// ========== REMAINING FUNCTIONS (loadFiles, displayFiles, trash, preview, theme, etc.) ==========
// Keep all your existing functions from the previous working version.
// I will not repeat them here to save space, but you must include them.
// Make sure you have: loadFiles, formatDateTime, formatFileSize, escapeHtml, getFileIcon, displayFiles,
// previewFile, closePreviewModal, downloadFile, deleteFile, restoreFile, permanentDeleteFile,
// loadTrash, displayTrash, showTrashView, closeTrashModal, setView, showMessage,
// createCloud, createParticle, themes, etc.

// ========== INIT ==========
checkAuth();