require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

const app = express();

// The fix: Trust the first proxy
app.set('trust proxy', 1);

// Allowed origin
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://your-app.onrender.com';

// CORS
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.status(200).json({});
    }
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Updated session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,       // Must be true on Render's HTTPS
        httpOnly: true,
        sameSite: 'none',   // Required for cross-origin requests
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));