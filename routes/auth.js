const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Helper for protected routes
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
        const hash = await bcrypt.hash(password, 10);
        const { error } = await supabase.from('users').insert([{ email, password: hash, name: 'User' }]);
        if (error?.code === '23505') return res.status(400).json({ error: 'Email already exists' });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const { data: users, error } = await supabase.from('users').select('*').eq('email', email);
        if (error || !users || users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        res.json({ success: true, email: user.email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login error' });
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
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password too short' });
    const { data: users } = await supabase.from('users').select('password').eq('id', req.session.userId);
    if (!users?.length) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(currentPassword, users[0].password);
    if (!match) return res.status(401).json({ error: 'Current password wrong' });
    const hash = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password: hash }).eq('id', req.session.userId);
    res.json({ success: true });
});

// Get profile
router.get('/profile', requireAuth, async (req, res) => {
    const { data, error } = await supabase.from('users').select('id, email, name, profile_picture').eq('id', req.session.userId).single();
    if (error) return res.status(500).json({ error: 'DB error' });
    res.json(data);
});

// Update name
router.put('/profile/name', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Name required' });
    await supabase.from('users').update({ name: name.trim() }).eq('id', req.session.userId);
    res.json({ success: true });
});

// Profile picture upload
const upload = multer({ storage: multer.memoryStorage() });
router.post('/profile/picture', requireAuth, upload.single('profile_pic'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const ext = req.file.originalname.split('.').pop();
    const fileName = `profile_${req.session.userId}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (uploadError) return res.status(500).json({ error: 'Upload failed: ' + uploadError.message });
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    await supabase.from('users').update({ profile_picture: urlData.publicUrl }).eq('id', req.session.userId);
    res.json({ success: true, profile_picture: urlData.publicUrl });
});

module.exports = router;