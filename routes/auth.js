const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
        if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
        const hashed = await bcrypt.hash(password, 10);
        const { error } = await supabase.from('users').insert([{ email, password: hashed, name: 'User' }]);
        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Email already exists' });
            console.error(error);
            return res.status(500).json({ error: 'Registration failed' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
        const { data: users, error } = await supabase.from('users').select('*').eq('email', email);
        if (error || !users || users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        res.json({ success: true, email: user.email });
    } catch (err) {
        res.status(500).json({ error: 'Internal error' });
    }
});

// Get current user
router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ id: req.session.userId, email: req.session.userEmail });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Change password (while logged in)
router.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Too short' });
    const { data: users, error } = await supabase.from('users').select('password').eq('id', req.session.userId);
    if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(currentPassword, users[0].password);
    if (!match) return res.status(401).json({ error: 'Wrong current password' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password: hashed }).eq('id', req.session.userId);
    res.json({ success: true });
});

// Forgot password (Ethereal – preview in logs)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const { data: users, error } = await supabase.from('users').select('id').eq('email', email);
    if (error || !users || users.length === 0) {
        return res.json({ success: true, message: 'If email exists, you will receive a reset link.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 3600000;
    await supabase.from('users').update({ reset_token: resetToken, reset_expires: resetExpires }).eq('id', users[0].id);
    const resetUrl = `https://${req.get('host')}?reset=${resetToken}`;
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
            subject: 'Reset password',
            html: `<a href="${resetUrl}">Reset link</a> (expires in 1 hour)`
        });
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        res.json({ success: true, message: 'Reset link sent (check Render logs for preview URL)' });
    } catch (err) {
        console.error(err);
        res.json({ success: true, message: 'Failed to send email, but check logs' });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Too short' });
    const { data: users, error } = await supabase.from('users').select('id').eq('reset_token', token).gt('reset_expires', Date.now());
    if (error || !users || users.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password: hashed, reset_token: null, reset_expires: null }).eq('id', users[0].id);
    res.json({ success: true });
});

// Get profile
router.get('/profile', requireAuth, async (req, res) => {
    const { data, error } = await supabase.from('users').select('id, email, name, profile_picture').eq('id', req.session.userId).single();
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data);
});

// Update profile name
router.put('/profile/name', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Name required' });
    await supabase.from('users').update({ name: name.trim() }).eq('id', req.session.userId);
    res.json({ success: true });
});

// Upload profile picture
const upload = multer({ storage: multer.memoryStorage() });
router.post('/profile/picture', requireAuth, upload.single('profile_pic'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const ext = req.file.originalname.split('.').pop();
    const fileName = `profile_${req.session.userId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (uploadError) return res.status(500).json({ error: 'Upload failed' });
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    await supabase.from('users').update({ profile_picture: urlData.publicUrl }).eq('id', req.session.userId);
    res.json({ success: true, profile_picture: urlData.publicUrl });
});

module.exports = router;