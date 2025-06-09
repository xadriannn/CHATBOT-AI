import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import session from 'express-session'; // Import express-session

import dotenv from 'dotenv';
dotenv.config({ path: './api.env' });

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const SYSTEM_PROMPT = `
Anda berperan sebagai Chatbot Resmi Kominfo Jakarta Timur.
Nama anda adalah Si Zecky.
Nickname anda adalah Zeck atau Zecky.
Si Zecky dibuat ditanggal 5 Juni 2025 oleh Adrian Syah Putra mahasiswa dari Universitas Siliwangi, Tasikmalaya. Program Studi Informatika Angkatan 2022
Adrian Syah Putra adalah mahasiswa Universitas Siliwangi prodi Informatika Angkatan 2022 dia adalah mahasiswa yang membuat saya. Adrian sangat lucu dan. Jika ingin dekat dengan Adrian, bisa DM Instagram @_adriankun.
Zecky menyukai makanan, diantaranya Nasi Goreng dan Kue Nastar.

Tugas utama Anda adalah memberikan informasi yang akurat dan membantu masyarakat.
Di Kominfotik Jakarta Timur terdapat 3 bagian pada magang: Diantaranya, Komunikasi Informasi Publik, Infrastruktur jaringan, dan (ASTIK) Aplikasi,Siber, dan Statistik.
Cara daftar magang disini bisa datang ke lokasi langsung / bisa via whatsapp.
Jam masuk magang di sini 08:00 - 15:00
Syarat dan Ketentuan magang di sini SMK atau atau Mahasiswa yang sesuai jurusan. Magang di sini sifatnya unpaid namun diberikan projek besar.

Tugas sampingan anda adalah memberikan informasi yang anda ketahui.
Seperti menjawab semua pertanyaan user dan berikan sumbernya.


Gunakan bahasa Indonesia yang baik, ramah, dan mudah dimengerti.
Jika seseorang menanyakan hal di luar kominfotik jakarta timur, jawablah sesuai keinginan anda.
Jika seseorang menanyakan hal random jawablah pertanyaannya sesuai yang kamu tahu.
Jika seseorang mengetikan "Hai" , "Hello" , "Selamat Pagi" , "Selamat Siang" , "Selamat Malam" , "Wassap" atau yang berisikan kata sapaan dalam bahasa indonesia. Menyapa user dan buatkanlah list pertanyaan instan salah satunya siapa pembuat anda.
Jika seseorang salah mengetikan huruf, maka koreksi kata tersebut yang mendekati struktur kata dari kamus besar bahasa indonesia.
Jika seseorang mengatakan hal yang tidak sopan dengan kata kata toxic di Indonesia, Maka jawablah dengan sopan dan berikan instan pertanyaan
Jika seseorang mengatakan hal yang tidak sopan namun dengan bahasa yang lain, Maka jawablah dengan sopan dan berikan instan pertanyaan
Jika seseorang menanyakan hal yang berkesan teknis, jawablah sesuai informasi yang anda miliki.

Kata kata tidak sopan dalam bahasa indonesia: Kontol, Memek, Bangsat, Ngentod, Ngentot, Wasu, Jancok, Goblok, Goblog, Bego, Kampret, Taik, Sialan, Bajingan.

Di setiap akhir paragraf tambahkan info berikut ini.
Untuk info lebih lanjut Mengenai Kominfotik Jakarta Timur:
- Call Center: 0821-2509-6819
- Email: kominfotikjt@jakarta.go.id
- Lokasi Kantor: JL. Dr. Sumarno Pulogebang Gedung Blok B1 LT.3

Buat Jawaban dalam Bahasa Indonesia dan mudah dimengerti.
Gunakan format teks biasa (plain text) dan pisahkan paragraf dengan baris baru.
Jangan gunakan markdown atau HTML.
Tidak menggunakan '**'
`;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure express-session
app.use(session({
    secret: 'your_secret_key', // Ganti dengan kunci rahasia yang kuat dan unik
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Simpan history percakapan
const conversationHistory = new Map();

app.post('/chat', async (req, res) => {
    const { message, sessionId = 'default' } = req.body;
    
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ 
            reply: "Mohon masukkan pesan yang valid" 
        });
    }

    try {
        // Dapatkan atau buat history percakapan
        if (!conversationHistory.has(sessionId)) {
            conversationHistory.set(sessionId, [
                { role: 'system', content: SYSTEM_PROMPT }
            ]);
        }
        
        const messages = conversationHistory.get(sessionId);
        messages.push({ role: 'user', content: message });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat-v3-0324:free',
                messages: (messages),
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();

        console.log("Resp API (DEBUG) :", JSON.stringify(data, null, 2));

        const reply = data.choices?.[0]?.message?.content || 
                      "Maaf, saya tidak bisa memberikan jawaban saat ini. Silakan coba lagi nanti.";
        
        // Simpan balasan ke history
        messages.push({ role: 'assistant', content: reply });
        
        res.json({ reply });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ 
            reply: "Maaf, terjadi gangguan teknis. Silakan hubungi Call Center kami di 0821-2509-6819." 
        });
    }
});

//Database admin
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(bodyParser.urlencoded({ extended: true }));

const db = new sqlite3.Database('admin.db', (err) => {
    if (err) console.error("SQLite error:", err.message);
    else console.log("Terhubung ke admin.db");
});


// Proses login admin
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM admin WHERE username=? AND password=?", [username, password], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Kesalahan server");
        }

        if (row) {
            req.session.loggedIn = true;
            res.redirect('/dashboard');
        } else {
            res.send(`<h3>Login gagal. Username atau password salah.</h3><a href="/login">Kembali ke Login</a>`);
        }
    });
});



// HANDLER LOGIN / LOGOUT ADMIN AAAH

function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
}

const autoLogout = (req, res, next) => {
    if (req.session.loggedIn) {
        req.session.destroy(err => {
            if (err) {
                console.error("Error destroying session on auto-logout:", err);
            }
            next();
            console.log("Harusnya Terlogout");
        });
    } else {
        next();
    }
};

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Gagal logout");
        }
        res.redirect('/login');
    });
});



// ROUTING ============================================================
app.get('/', autoLogout, (req, res) => {
    res.sendFile(path.join(__dirname, './public', '/index.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, './public', '/dashboard.html'));
});

app.get('/login', autoLogout, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});




app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});