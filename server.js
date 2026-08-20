const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middleware untuk menyajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 2. Route eksplisit untuk admin panel (harus sebelum fallback SPA)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 3. Fallback SPA untuk semua route lain
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan server cuma pas lokal (dev). Di Vercel, app-nya di-require
// langsung sebagai serverless function, jadi listen() nggak perlu jalan.
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server GetasMart berjalan di http://localhost:${PORT}`);
    });
}

module.exports = app;