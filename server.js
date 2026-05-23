require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

const app = express();
app.set('trust proxy', 1);

// CORS (allow your Vercel domain)
app.use((req, res, next) => {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://your-app.vercel.app';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Cookie');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Health check endpoint (optional)
app.get('/ping', (req, res) => res.send('pong'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,       // Vercel uses HTTPS
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Vercel requires export, not app.listen()
module.exports = app;