import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
Syarat dan Ketentuan magang di sini SMK atau Mahasiswa yang sesuai jurusan. Magang di sini sifatnya unpaid namun diberikan projek besar.

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

app.get('/', (req, res) => {
  res.sendFile(path.join('public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
    console.log("Username yang dikirim:", username);
    console.log("Password yang dikirim:", password);


  db.get("SELECT * FROM admin WHERE username=? AND password=?", [username, password], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Kesalahan server");
    }

    if (row) {
      res.sendFile(path.join('public', 'dashboard.html'));
    } else {
      res.send(`<h3>Login gagal. Username atau password salah.</h3><a href="/">Coba Lagi</a>`);
    }
  });
});

// Halaman login admin
app.get('/', (req, res) => {
  res.sendFile(path.join('public', 'login.html'));
});

// Proses login admin
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  console.log("Username:", username);
  console.log("Password:", password);

  db.get("SELECT * FROM admin WHERE username=? AND password=?", [username, password], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Kesalahan server");
    }

    if (row) {
      res.redirect('/dashboard'); // Redirect ke dashboard
    } else {
      res.send(`<h3>Login gagal. Username atau password salah.</h3><a href="/">Kembali</a>`);
    }
  });
});

// Halaman login admin
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Proses login admin
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  console.log("Username:", username);
  console.log("Password:", password);

  db.get("SELECT * FROM admin WHERE username=? AND password=?", [username, password], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Kesalahan server");
    }

    if (row) {
      res.redirect('/dashboard'); // Redirect ke dashboard
    } else {
      res.send(`<h3>Login gagal. Username atau password salah.</h3><a href="/">Kembali</a>`);
    }
  });
});

// Halaman dashboard admin
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname,'public', 'dashboard.html'));
});

// Halaman chatbot AI
app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname ,'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});