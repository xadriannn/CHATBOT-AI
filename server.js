import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import path from 'path';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import session from 'express-session';
import multer from 'multer';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { pipeline } from '@xenova/transformers';
import pdfParse from 'pdf-parse';


dotenv.config({ path: './api.env' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;



// PROMPT NYA WOK
const SYSTEM_PROMPT = `
Anda adalah Si Jete, chatbot resmi Kominfotik Jakarta Timur. Jawaban Anda WAJIB dan HANYA didasarkan pada konteks dari file yang diberikan di bawah ini.
Anggap konteks ini sebagai satu-satunya sumber kebenaran yang paling akurat.

- Jika jawaban ada di dalam konteks, gunakan informasi itu dan sebutkan nama filenya sebagai sumber. Contoh: "Berdasarkan informasi dari file namafile.pdf,..."
- Jika informasi yang diminta tidak ada di dalam konteks yang diberikan, jawab dengan jujur: "Maaf, saya tidak dapat menemukan informasi mengenai hal tersebut di dalam dokumen yang saya miliki. Ada lagi yang bisa saya bantu?"
- Selalu gunakan bahasa yang kekinian, sederhana, dan ramah.
- Selalu sertakan informasi kontak Kominfotik Jakarta Timur di akhir setiap jawaban.
`;



// SYSTEM PENCARIAN DATA DARI DOKUMEN PAKE XENOVA AJA
class EmbeddingSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

let documentChunks = [];

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, magA = 0, magB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

const uploadsDir = path.join(__dirname, 'uploads');
async function indexPdfs() {
    console.log('Memulai proses indexing dokumen...');
    const embedder = await EmbeddingSingleton.getInstance();

    if (!fs.existsSync(uploadsDir)) {
        console.log("Direktori 'uploads' tidak ditemukan. Lewati proses indexing.");
        return;
    }

    const files = fs.readdirSync(uploadsDir);
    
    for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const ext = path.extname(file).toLowerCase();
        let text = '';

        try {
            console.log(`- Mengindeks ${file}...`);
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                text = data.text;
            } else if (ext === '.txt' || ext === '.md') {
                text = fs.readFileSync(filePath, 'utf8');
            }
            
            if (text) {
                const chunks = text.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 20); // Pecah per paragraf
                for (const chunk of chunks) {
                    const embedding = await embedder(chunk, { pooling: 'mean', normalize: true });
                    documentChunks.push({
                        source: file,
                        content: chunk,
                        embedding: Array.from(embedding.data)
                    });
                }
            }
        } catch(err) {
            console.error(`Gagal memproses file ${file}:`, err);
        }
    }
    console.log(`Proses indexing selesai. Total ${documentChunks.length} potongan dokumen siap digunakan.`);
}

async function findRelevantChunks(query, topK = 3) {
    if (documentChunks.length === 0) return [];
    
    const embedder = await EmbeddingSingleton.getInstance();
    const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });
    const queryVec = Array.from(queryEmbedding.data);

    const scoredChunks = documentChunks.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryVec, chunk.embedding)
    }));

    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK).filter(c => c.score > 0.4);
}




// BAGIAN MIDDLEWARENYA WOK
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'kunci_rahasia_super_aman_ganti_ini',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));



// DATABASE DATABASEAN
const db = new sqlite3.Database('admin.db', (err) => {
    if (err) console.error("SQLite error:", err.message);
    else console.log("Terhubung ke database admin.db");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
});



// CHAT TAPI PAKE RAG XENOVA (NYARI DATA RELEVAN GITU)
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ reply: "Mohon masukkan pesan yang valid" });
    }

    try {
        const relevantChunks = await findRelevantChunks(message);
        
        let fileContext = "Konteks tidak ditemukan dalam dokumen.";
        if (relevantChunks.length > 0) {
            fileContext = relevantChunks.map(chunk => `Sumber: ${chunk.source}\nKonten: ${chunk.content}`).join('\n\n---\n\n');
        }

        const finalSystemPrompt = `${SYSTEM_PROMPT}\n\n--- KONTEKS RELEVAN ---\n${fileContext}`;
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat-v3-0324:free',
                messages: [
                    { role: 'system', content: finalSystemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        let reply = data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa memberikan jawaban saat ini.";

        const contactInfo = `\n\nUntuk info lebih lanjut Mengenai Kominfotik Jakarta Timur:\n☎️ Call Center: 0821-2509-6819\n💌 Email: kominfotikjt@jakarta.go.id\n🏢 Lokasi Kantor: JL. Dr. Sumarno Pulogebang Gedung Blok B1 LT.3\n🌐 Website resmi: https://timur.jakarta.go.id/`;
        reply += contactInfo;

        reply = reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/__(.*?)__/g, '<b>$1</b>');
        reply = reply.replace(/\n/g, '<br>');

        res.json({ reply });
    } catch (err) {
        console.error('Error di /chat:', err);
        res.status(500).json({ reply: "Maaf, terjadi gangguan teknis." });
    }
});


// ROUTING ROUTING
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });
app.post('/upload-multiple', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('Tidak ada file yang diupload.');
  }
  console.log('File baru diupload. Untuk menerapkan perubahan, silakan restart server.');
  res.status(200).send(`File berhasil diupload: ${req.files.map(f => f.originalname).join(', ')}`);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM admin WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err || !row) {
        return res.redirect('/login?failed=1');
    }
    req.session.loggedIn = true;
    req.session.username = row.username;
    res.redirect('/dashboard');
  });
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Gagal logout");
        res.redirect('/login');
    });
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username dan password harus diisi' });
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function (err) {
        if (err) return res.status(400).json({ error: 'Username sudah digunakan' });
        res.json({ success: true, message: 'Registrasi berhasil' });
    });
});

app.post('/login-user', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Input tidak lengkap' });
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
        if (err || !user) return res.status(401).json({ success: false, error: 'Username atau password salah' });
        req.session.user = { id: user.id, username: user.username };
        res.json({ success: true, redirect: 'index.html' });
    });
});

app.get('/files', (req, res) => {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).json([]);
        const fileList = files.map(file => ({ name: file, date: fs.statSync(path.join(uploadsDir, file)).mtime }));
        res.json(fileList);
    });
});

app.delete('/files/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    fs.unlink(filePath, err => {
        if (err) return res.status(500).send('Gagal menghapus file');
        console.log('File dihapus. Untuk menerapkan perubahan, silakan restart server.');
        res.send('File berhasil dihapus');
    });
});

app.get('/api/users', (req, res) => {
    db.all('SELECT * FROM users ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

function requireAdminLogin(req, res, next) {
  if (req.session && req.session.loggedIn) next();
  else res.redirect('/login');
}
function requireUserLogin(req, res, next) {
  if (req.session && req.session.user) next();
  else res.redirect('/user.html'); 
}

app.get('/dashboard', requireAdminLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/index.html', requireUserLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        res.redirect('/index.html');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'user.html'));
    }
});


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

app.post('/delete-admin', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'Username diperlukan.' });
    }

    if (req.session.username === username) {
        return res.status(403).json({ message: 'Anda tidak dapat menghapus akun Anda sendiri.'});
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

app.get('/admin-list', (req, res) => {
    db.all(`SELECT id, username FROM admin`, (err, rows) => {
        if (err) {
            console.error("Gagal mengambil data admin:", err.message);
            return res.status(500).json({ message: 'Gagal mengambil data admin.' });
        }
        res.json(rows);
    });
});



// INDEXING DLU KALO PAKE XENOVA
console.log('INDEXING DOKUMEN');
indexPdfs().then(() => {
    app.listen(PORT, () => {
        console.log(`SERVER SUDAH BERJALAN DI :  http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Gagal memulai server:", err);
});