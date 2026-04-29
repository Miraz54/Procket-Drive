const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
    // Do not crash, but will fail later
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Email transporter (ethereal)
let transporter = null;
async function getTransporter() {
    if (!transporter) {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass }
        });
        console.log('📧 Test email account:', testAccount.user);
    }
    return transporter;
}

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// --- REGISTER (fixed error handling) ---
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
        if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

        const hashed = await bcrypt.hash(password, 10);
        const { data, error } = await supabase
            .from('users')
            .insert([{ email, password: hashed, name: 'User' }])
            .select();

        if (error) {
            console.error('Supabase insert error:', error);
            if (error.code === '23505') return res.status(400).json({ error: 'Email already exists' });
            return res.status(500).json({ error: 'Registration failed: ' + error.message });
        }
        res.json({ success: true, message: 'Account created' });
    } catch (err) {
        console.error('Register catch:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

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
        res.status(500).json({ error: 'Internal error' });
    }
});

// --- ME, LOGOUT, CHANGE PASSWORD, FORGOT, RESET, PROFILE ---
router.get('/me', requireAuth, (req, res) => {
    res.json({ id: req.session.userId, email: req.session.userEmail });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
    const { data: users, error } = await supabase.from('users').select('password').eq('id', req.session.userId);
    if (error || !users || users.length === 0) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(currentPassword, users[0].password);
    if (!match) return res.status(401).json({ error: 'Wrong current password' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password: hashed }).eq('id', req.session.userId);
    res.json({ success: true });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const { data: users, error } = await supabase.from('users').select('id').eq('email', email);
    if (error || !users || users.length === 0) {
        return res.json({ success: true, message: 'If email exists, reset link sent' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000;
    await supabase.from('users').update({ reset_token: token, reset_expires: expires }).eq('id', users[0].id);
    const resetUrl = `https://${req.get('host')}?reset=${token}`;
    try {
        const transporter = await getTransporter();
        const info = await transporter.sendMail({
            from: '"Pocket Drive" <noreply@pocketdrive.com>',
            to: email,
            subject: 'Password Reset',
            html: `<a href="${resetUrl}">Reset password</a> (expires 1 hour)`
        });
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        res.json({ success: true, message: 'Reset link sent (check console)' });
    } catch(e) { res.json({ success: true, message: 'Reset link generated. See console.' }); }
});

router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and password required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });
    const { data: users, error } = await supabase.from('users').select('id').eq('reset_token', token).gt('reset_expires', Date.now());
    if (error || !users || users.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password: hashed, reset_token: null, reset_expires: null }).eq('id', users[0].id);
    res.json({ success: true });
});

router.get('/profile', requireAuth, async (req, res) => {
    const { data, error } = await supabase.from('users').select('id, email, name, profile_picture').eq('id', req.session.userId).single();
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(data);
});

router.put('/profile/name', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Name required' });
    await supabase.from('users').update({ name: name.trim() }).eq('id', req.session.userId);
    res.json({ success: true });
});

// Profile picture upload (using bucket 'avatars')
const upload = multer({ storage: multer.memoryStorage() });
router.post('/profile/picture', requireAuth, upload.single('profile_pic'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = req.file.originalname.split('.').pop();
    const fileName = `profile_${req.session.userId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (uploadError) return res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    await supabase.from('users').update({ profile_picture: urlData.publicUrl }).eq('id', req.session.userId);
    res.json({ success: true, profile_picture: urlData.publicUrl });
});

module.exports = router;