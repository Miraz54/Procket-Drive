const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// ==================== SUPABASE CLIENT ====================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==================== MIDDLEWARE ====================
function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// ==================== REGISTER ====================
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const hashed = await bcrypt.hash(password, 10);
        const { error } = await supabase
            .from('users')
            .insert([{ email, password: hashed, name: 'User' }]);

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Email already exists' });
            console.error('Supabase insert error:', error);
            return res.status(500).json({ error: 'Registration failed' });
        }
        res.json({ success: true, message: 'Account created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email);

        if (error || !users || users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        res.json({ success: true, email: user.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== GET CURRENT USER ====================
router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ id: req.session.userId, email: req.session.userEmail });
});

// ==================== LOGOUT ====================
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ==================== CHANGE PASSWORD (while logged in) ====================
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const { data: users, error } = await supabase
            .from('users')
            .select('password')
            .eq('id', req.session.userId);
        if (error || !users || users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const match = await bcrypt.compare(currentPassword, users[0].password);
        if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

        const hashed = await bcrypt.hash(newPassword, 10);
        await supabase
            .from('users')
            .update({ password: hashed })
            .eq('id', req.session.userId);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== FORGOT PASSWORD (Ethereal – no timeout) ====================
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Find user (do NOT reveal existence)
    const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);
    if (error || !users || users.length === 0) {
        return res.json({ success: true, message: 'If that email is registered, you will receive a reset link.' });
    }
    const user = users[0];

    // Generate reset token (1 hour expiry)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 3600000;
    await supabase
        .from('users')
        .update({ reset_token: resetToken, reset_expires: resetExpires })
        .eq('id', user.id);

    const resetUrl = `https://${req.get('host')}?reset=${resetToken}`;

    // Use Ethereal (no real SMTP config needed)
    try {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass }
        });
        const info = await transporter.sendMail({
            from: '"Pocket Drive" <noreply@pocketdrive.com>',
            to: email,
            subject: 'Reset your Pocket Drive password',
            html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`
        });
        console.log('🔗 Password reset preview URL:', nodemailer.getTestMessageUrl(info));
        res.json({ success: true, message: 'Reset link sent (check Render logs for preview URL).' });
    } catch (err) {
        console.error('Email sending failed:', err.message);
        res.json({ success: true, message: 'Failed to send email. Please try again later.' });
    }
});

// ==================== RESET PASSWORD (with token) ====================
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('reset_token', token)
        .gt('reset_expires', Date.now());

    if (error || !users || users.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase
        .from('users')
        .update({ password: hashed, reset_token: null, reset_expires: null })
        .eq('id', users[0].id);

    res.json({ success: true, message: 'Password reset successful. You can now log in.' });
});

// ==================== PROFILE (GET) ====================
router.get('/profile', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, email, name, profile_picture')
        .eq('id', req.session.userId)
        .single();
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data);
});

// ==================== UPDATE PROFILE NAME ====================
router.put('/profile/name', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Name required' });
    await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', req.session.userId);
    res.json({ success: true });
});

// ==================== UPLOAD PROFILE PICTURE (Supabase Storage) ====================
const upload = multer({ storage: multer.memoryStorage() });
router.post('/profile/picture', requireAuth, upload.single('profile_pic'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop();
    const fileName = `profile_${req.session.userId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
        });
    if (uploadError) return res.status(500).json({ error: 'Upload failed: ' + uploadError.message });

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    await supabase
        .from('users')
        .update({ profile_picture: urlData.publicUrl })
        .eq('id', req.session.userId);
    res.json({ success: true, profile_picture: urlData.publicUrl });
});

module.exports = router;