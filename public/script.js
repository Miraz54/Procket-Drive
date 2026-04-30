// ========== FORGOT & RESET PASSWORD FUNCTIONS ==========
function showForgotPassword() {
    document.getElementById('forgotModal').style.display = 'flex';
}

function closeForgotModal() {
    document.getElementById('forgotModal').style.display = 'none';
    document.getElementById('forgotEmail').value = '';
    document.getElementById('forgotMessage').innerHTML = '';
}

async function sendResetLink() {
    const email = document.getElementById('forgotEmail').value;
    const msgDiv = document.getElementById('forgotMessage');

    if (!email) {
        msgDiv.innerHTML = '<span class="error">Please enter your email</span>';
        return;
    }

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (response.ok) {
            msgDiv.innerHTML = '<span class="success">' + data.message + '</span>';
            setTimeout(closeForgotModal, 3000);
        } else {
            msgDiv.innerHTML = '<span class="error">' + data.error + '</span>';
        }
    } catch (err) {
        msgDiv.innerHTML = '<span class="error">Network error. Check console.</span>';
        console.error(err);
    }
}

// Reset password modal (when user clicks email link)
let resetToken = null;

function showResetPasswordModal() {
    document.getElementById('resetModal').style.display = 'flex';
}

function closeResetModal() {
    document.getElementById('resetModal').style.display = 'none';
    document.getElementById('resetNewPassword').value = '';
    document.getElementById('resetConfirmPassword').value = '';
    document.getElementById('resetMessage').innerHTML = '';
    if (resetToken) {
        resetToken = null;
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function submitResetPassword() {
    const newPass = document.getElementById('resetNewPassword').value;
    const confirmPass = document.getElementById('resetConfirmPassword').value;
    const msgDiv = document.getElementById('resetMessage');

    if (!newPass || !confirmPass) {
        msgDiv.innerHTML = '<span class="error">Fill both fields</span>';
        return;
    }
    if (newPass.length < 6) {
        msgDiv.innerHTML = '<span class="error">Password must be at least 6 characters</span>';
        return;
    }
    if (newPass !== confirmPass) {
        msgDiv.innerHTML = '<span class="error">Passwords do not match</span>';
        return;
    }
    if (!resetToken) {
        msgDiv.innerHTML = '<span class="error">Invalid reset token</span>';
        return;
    }

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, newPassword: newPass })
        });
        const data = await response.json();
        if (response.ok) {
            msgDiv.innerHTML = '<span class="success">Password reset successful! Redirecting...</span>';
            setTimeout(() => {
                closeResetModal();
                window.location.href = '/';
            }, 2000);
        } else {
            msgDiv.innerHTML = '<span class="error">' + data.error + '</span>';
        }
    } catch (err) {
        msgDiv.innerHTML = '<span class="error">Network error</span>';
        console.error(err);
    }
}

// Check for reset token in URL on page load
function checkResetToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset');
    if (token) {
        resetToken = token;
        showResetPasswordModal();
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Run this on page load
checkResetToken();