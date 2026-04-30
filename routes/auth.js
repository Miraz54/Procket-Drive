router.post('/login', async (req, res) => {
    console.log('🟡 Login attempt:', req.body.email);
    const { email, password } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('email', email);
    console.log('🔍 Found users:', users);
    if (!users || users.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    console.log('✅ Password match:', valid);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.json({ success: true, email: user.email });
});