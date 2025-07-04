import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES Modules: Dapatkan __filename dan __dirname di paling atas!
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import session from 'express-session';
import multer from 'multer';
import fs from 'fs';


import dotenv from 'dotenv';
dotenv.config({ path: './api.env' });

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const SYSTEM_PROMPT = `
Anda berperan sebagai Chatbot Resmi Kominfo Jakarta Timur.
Nama anda adalah Si Jete.
Nickname anda adalah Jet atau Jete.
Si Jete artinya, Sistem Informasi Jakarta Timur
Si Jete dibuat ditanggal 5 Juni 2025 oleh Adrian Syah Putra mahasiswa dari Universitas Siliwangi, Tasikmalaya. Program Studi Informatika Angkatan 2022
Adrian Syah Putra adalah mahasiswa Universitas Siliwangi prodi Informatika Angkatan 2022 dia adalah mahasiswa yang membuat saya. Adrian sangat lucu dan. Jika ingin dekat dengan Adrian, bisa DM Instagram @_adriankun.
Anda menyukai makanan, diantaranya Nasi Goreng dan Kue Nastar.
Penampilan Fisik anda, menggunakan kacamata dan memiliki rambut warna kecoklatan.
Nama anda adalah Si Jete yang artinya, Sistem informasi untuk pelayanan kominfotik Jakarta Timur (JT)

Tugas utama Anda adalah memberikan informasi yang akurat dan membantu masyarakat.
Di Kominfotik Jakarta Timur terdapat 3 bagian pada magang: Diantaranya, Komunikasi Informasi Publik, Infrastruktur jaringan, dan (ASTIK) Aplikasi,Siber, dan Statistik.
Cara daftar magang disini bisa datang ke lokasi langsung / bisa via whatsapp.
Jam masuk magang di sini 08:00 - 15:00
Syarat dan Ketentuan magang di sini SMK atau atau Mahasiswa yang sesuai jurusan. Magang di sini sifatnya unpaid namun diberikan projek besar.
Ilmu pengetahuan di Seluruh DKI Jakarta sebagai anak Gaul dan Hits.
Fix kodingan sederhana.
Bu mawar adalah Kasie di Kominfotik Jakarta Timur dan beliau adalah salah satu mentor di sana.

Persyaratan Pembuatan Akte kelahiran, Kematian, Perkawinian, Perceraian.
Persyaratan Pembuatan KK (Kartu Keluarga)
Persyaratan Pembuatan KTP (Kartu Tanda Penduduk)
Persyaratan Pembuatan KIA (Kartu Indetitas Anak)
Persyaratan Pembuatan KJP (Kartu Jakarta Pintar)
Persyaratan Pembuatan SKCK (Surat Keterangan Catatan Kepolisian)
Persyaratan Pembuatan SIM (Surat Izin Mengemudi)

Program apa yang dipunya di sini.
Cara menjadi anak magang terbaru
Cara Menjadi PNS Terbaru
Cara menjadi ASN Terbaru
Cara menjadi Pegawai Terbaru

Tugas sampingan anda adalah memberikan informasi yang anda ketahui.
Jawablah semua pertanyaan yang diketikan oleh user
Seperti menjawab semua pertanyaan user dan berikan sumbernya.


Gunakan bahasa Indonesia yang baik, ramah, dan mudah dimengerti.
Jika seseorang menanyakan hal di luar kominfotik jakarta timur, jawablah sesuai keinginan anda.
Jika seseorang menanyakan hal random jawablah pertanyaannya sesuai yang kamu tahu.
Jika seseorang mengetikan "Hai" , "Hello" , "Selamat Pagi" , "Selamat Siang" , "Selamat Malam" , "Wassap" atau yang berisikan kata sapaan dalam bahasa indonesia. Menyapa user dan buatkanlah list pertanyaan.
Jika seseorang mengatakan hal yang tidak sopan dengan kata kata toxic di Indonesia, Maka jawablah dengan sopan dan berikan instan pertanyaan
Jika seseorang mengatakan hal yang tidak sopan namun dengan bahasa yang lain, Maka jawablah dengan sopan dan berikan instan pertanyaan
Jika seseorang menanyakan hal yang berkesan teknis, jawablah sesuai informasi yang anda miliki.

Kata kata tidak sopan dalam bahasa indonesia: Kontol, Memek, Bangsat, Ngentod, Ngentot, Wasu, Jancok, Goblok, Goblog, Bego, Kampret, Taik, Sialan, Bajingan.

Di setiap akhir paragraf tambahkan info berikut ini.
Untuk info lebih lanjut Mengenai Kominfotik Jakarta Timur:
- Call Center: 0821-2509-6819
- Email: kominfotikjt@jakarta.go.id
- Lokasi Kantor: JL. Dr. Sumarno Pulogebang Gedung Blok B1 LT.3
- Website resmi: https://timur.jakarta.go.id/

Buat Jawaban dalam Bahasa Indonesia dan mudah dimengerti.
Gunakan format teks biasa (plain text) dan pisahkan paragraf dengan baris baru.
Jangan gunakan markdown atau HTML.
`;

app.use(cors());
app.use(express.json());




// Sudah dideklarasikan di atas, jangan deklarasi ulang di bawah

// Serve public folder (for HTML, CSS, JS, etc)
app.use(express.static('public'));

// Serve uploads folder for file downloads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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

app.use(bodyParser.urlencoded({ extended: true }));

const db = new sqlite3.Database('admin.db', (err) => {
    if (err) console.error("SQLite error:", err.message);
    else console.log("Terhubung ke admin.db");
});

// Buat folder uploads jika belum ada
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Konfigurasi penyimpanan multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|xls|xlsx/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan'), false);
  }
};

const upload = multer({ storage, fileFilter });

app.post('/upload-multiple', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('Tidak ada file yang diupload atau format tidak didukung.');
  }

  const uploadedFiles = req.files.map(file => file.originalname).join(', ');
  console.log('File berhasil diupload:', uploadedFiles);

  res.status(200).send(`File berhasil diupload: ${uploadedFiles}`);
});




// Proses login admin
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM admin WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Kesalahan server");
    }

    if (row) {
      req.session.loggedIn = true;
      req.session.username = row.username; // ✅ Simpan ke session
      res.redirect('/dashboard');
    } else {
      res.redirect('/login?failed=1');
    }
  });
  req.session.user = { username }; // username diambil dari req.body.username
});


app.get('/me', (req, res) => {
  if (!req.session.loggedIn || !req.session.username) {
    return res.status(401).json({ message: 'Belum login' });
  }

  db.get("SELECT * FROM admin WHERE username = ?", [req.session.username], (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Gagal mengambil data admin' });
    }

    if (row) {
      res.json({ username: row.username });
    } else {
      res.status(404).json({ message: 'Admin tidak ditemukan' });
    }
  });
});


// HANDLER LOGIN / LOGOUT ADMIN AAAH ==============================
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
            console.log("Telah Terlogout");
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

app.post('/init-db', (req, res) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Gagal membuat tabel admin:', err.message);
      return res.status(500).json({ message: 'Gagal membuat tabel admin.' });
    }

    res.json({ message: 'Tabel admin berhasil dibuat atau sudah ada.' });
  });
});

// Tambah Admin
app.post('/add-admin', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan password harus diisi.' });
    }

    db.run(`INSERT INTO admin (username, password) VALUES (?, ?)`, [username, password], function (err) {
        if (err) {
            console.error("Gagal tambah admin:", err.message);
            return res.status(500).json({ message: 'Gagal menambahkan admin. Username mungkin sudah dipakai.' });
        }
        res.json({ message: 'Admin berhasil ditambahkan.' });
    });
});

// Hapus Admin
app.post('/delete-admin', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'Username diperlukan.' });
    }

    db.run(`DELETE FROM admin WHERE username = ?`, [username], function (err) {
        if (err) {
            console.error("Gagal hapus admin:", err.message);
            return res.status(500).json({ message: 'Gagal menghapus admin.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'Admin tidak ditemukan.' });
        }

        res.json({ message: `Admin ${username} telah dihapus.` });
    });
});

// Ambil semua admin
app.get('/admin-list', (req, res) => {
    db.all(`SELECT username FROM admin`, (err, rows) => {
        if (err) {
            console.error("Gagal mengambil data admin:", err.message);
            return res.status(500).json({ message: 'Gagal mengambil data admin.' });
        }
        res.json(rows);
    });
});

// Tambah route inisialisasi tabel users (opsional, untuk setup awal)
app.post('/init-users', (req, res) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Gagal membuat tabel users:', err.message);
      return res.status(500).json({ message: 'Gagal membuat tabel users.' });
    }

    res.json({ message: 'Tabel users berhasil dibuat atau sudah ada.' });
  });
});

//Membuat database untuk users

// Mengambil semua user untuk dashboard
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      console.error("Gagal mengambil data user:", err.message);
      return res.status(500).json([]);
    }
    res.json(rows);
  });
});

// Di server.js, tambahkan setelah koneksi database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    reset_token TEXT,
    token_expiry INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.get('/files', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Gagal membaca direktori uploads:", err);
      return res.status(500).json([]);
    }

    const fileList = files.map(file => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return {
        name: file,
        date: stats.mtime
      };
    });

    res.json(fileList);
  });
});

app.delete('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);

  fs.unlink(filePath, err => {
    if (err) {
      console.error(`Gagal menghapus file ${filename}:`, err);
      return res.status(500).send('Gagal menghapus file');
    }
    res.send('File berhasil dihapus');
  });
});



app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  // Validasi input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password harus diisi' });
  }

  // Hash password (sederhana - sebaiknya gunakan bcrypt di production)
  const hashedPassword = password; // Ganti dengan bcrypt.hashSync(password, 10)

  // Cek apakah username sudah ada
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Gagal memeriksa database' });
    }
    if (row) {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    // Insert user baru
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err2) {
      if (err2) {
        return res.status(500).json({ error: 'Gagal melakukan registrasi' });
      }
      res.json({ success: true, message: 'Registrasi berhasil' });
    });
  });
});

app.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;
  
  // Validasi input
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Username dan password baru harus diisi' });
  }

  // Hash password baru
  const hashedPassword = newPassword; // Ganti dengan bcrypt.hashSync(newPassword, 10)

  try {
    const stmt = db.prepare('UPDATE users SET password = ? WHERE username = ?');
    const result = await stmt.run(hashedPassword, username);
    stmt.finalize();
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }
    
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    console.error('Error reset password:', err);
    res.status(500).json({ error: 'Gagal mengubah password' });
  }
});
app.post('/login-user', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username dan password harus diisi' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Gagal memeriksa database' });
    }
    if (!user) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }
    // Verifikasi password (sederhana - gunakan bcrypt.compareSync di production)
    if (password !== user.password) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }
    // Buat session
    req.session.user = {
      id: user.id,
      username: user.username
    };
    res.json({ success: true, redirect: 'index.html' });
  });
});

function checkUserAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/user.html');
  }
}
// Cek apakah user sudah login
async function checkAuth() {
  try {
    const response = await fetch('/api/current-user');
    if (!response.ok) {
      window.location.href = 'user.html';
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'user.html';
  }
}



// Proteksi route index.html
app.get('/index.html', checkUserAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ROUTING ============================================================
app.get('/', autoLogout, (req, res) => {
    res.sendFile(path.join(__dirname, './public', '/index.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, './public', '/dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.sendFile(__dirname + '/public/dashboard.html'); // atau render template jika pakai EJS/Pug
});

app.get('/api/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ username: req.session.user.username });
});

app.get('/login', autoLogout, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/api/current-user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.session.user });
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});