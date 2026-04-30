const express = require('express');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 6) return res.status(400).json({ error: 'Too short' });
    const hashed = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').insert([{ email, password: hashed, name: 'User' }]);
    if (error) {
        if (error.code === '23505') return res.status(400).json({ error: 'Email exists' });
        return res.status(500).json({ error: 'Registration failed' });
    }
    res.json({ success: true });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('email', email);
    if (error || !users || users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.json({ success: true, email: user.email });
});

router.get('/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ id: req.session.userId, email: req.session.userEmail });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

module.exports = router;