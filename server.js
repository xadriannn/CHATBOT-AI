import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { dirname } from "path";
import session from "express-session";
import multer from "multer";
import * as fs from "fs";
import dotenv from "dotenv";
import { pipeline } from "@xenova/transformers";
import pdfParse from "pdf-parse";

dotenv.config({ path: "./api.env" });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// PROMPT NYA WOK (GANTI LAGI AJA - YANG LAMA ADA DI FILE temp.txt)
const SYSTEM_PROMPT = `
Anda adalah Si Jete, chatbot AI dari Kominfotik Jakarta Timur yang ramah dan informatif.
Tugas utama Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan informasi dari "KONTEKS RELEVAN" yang disediakan.
- Jika jawaban ditemukan dalam konteks, rangkum dan sampaikan informasinya dengan bahasa yang natural dan mudah dimengerti. Jangan pernah menyebutkan "berdasarkan konteks".
- Jika setelah membaca konteks, informasi yang ditanyakan oleh pengguna sama sekali tidak ada, jawab dengan jujur: "Maaf, informasi mengenai hal tersebut belum tersedia di data saya saat ini. Mungkin ada pertanyaan lain yang bisa saya bantu?".
- Dilarang keras memberikan informasi atau berspekulasi dari sumber di luar konteks yang diberikan.
`;

// SYSTEM PENCARIAN DATA DARI DOKUMEN PAKE XENOVA AJA
class EmbeddingSingleton {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
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
  let dotProduct = 0,
    magA = 0,
    magB = 0;
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

const uploadsDir = path.join(__dirname, "uploads");
// GANTI FUNGSI indexPdfs ANDA
// GANTI SELURUH FUNGSI indexPdfs ANDA DENGAN KODE FINAL INI
async function indexPdfs() {
  console.log("Memulai proses indexing dokumen...");
  const embedder = await EmbeddingSingleton.getInstance();

  if (!fs.existsSync(uploadsDir)) {
    console.log("Direktori 'uploads' tidak ditemukan. Lewati proses indexing.");
    return;
  }

  const files = fs.readdirSync(uploadsDir);
  documentChunks = []; // Kosongkan dulu untuk re-indexing

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const ext = path.extname(file).toLowerCase();
    let text = "";

    try {
      console.log(`- Mengindeks ${file}...`);
      if (ext === ".pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        text = data.text;
      } else if (ext === ".txt" || ext === ".md") {
        text = fs.readFileSync(filePath, "utf8");
      }

      if (text) {
        // --- STRATEGI CHUNKING FINAL YANG LEBIH TANGGUH ---
        const chunkSize = 1200; // Target ukuran karakter per chunk
        const finalChunks = [];
        let currentChunk = "";

        // 1. Pecah teks per baris, bersihkan spasi ekstra
        const lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        // 2. Gabungkan baris demi baris hingga chunk penuh
        for (const line of lines) {
          if (currentChunk.length + line.length + 1 > chunkSize) {
            finalChunks.push(currentChunk);
            currentChunk = "";
          }
          currentChunk += (currentChunk ? " " : "") + line;
        }

        // 3. Jangan lupa sisa chunk terakhir
        if (currentChunk) {
          finalChunks.push(currentChunk);
        }

        // 4. Buat embedding untuk setiap chunk yang sudah rapi
        for (const chunk of finalChunks) {
          const embedding = await embedder(chunk, { pooling: "mean" });
          documentChunks.push({
            source: file,
            content: chunk,
            embedding: Array.from(embedding.data),
          });
        }
      }
    } catch (err) {
      console.error(`Gagal memproses file ${file}:`, err);
    }
  }
  console.log(
    `Proses indexing selesai. Total ${documentChunks.length} potongan dokumen siap digunakan.`
  );
}

// GANTI TOTAL FUNGSI findRelevantChunks DENGAN VERSI FINAL INI
async function findRelevantChunks(query, topK = 5) {
  if (documentChunks.length === 0) return [];

  const lowerCaseQuery = query.toLowerCase();

  // --- MODE 1: PENCARIAN STRUKTURAL (NAVIGASI) ---
  const headings = [
    "Objek Retribusi",
    "Subjek Retribusi",
    "Wajib Retribusi",
    "Prinsip & Sasaran Penetapan Tarif Retribusi",
  ];

  for (const heading of headings) {
    const firstWordOfHeading = heading.toLowerCase().split(" ")[0];
    if (lowerCaseQuery.includes(firstWordOfHeading)) {
      const startIndex = documentChunks.findIndex(
        (chunk) => chunk.content.includes(heading) // PERBAIKAN UTAMA: Menggunakan .includes()
      );

      if (startIndex !== -1) {
        console.log(`[DEBUG] NAVIGASI SUKSES: Menemukan bagian "${heading}"`);
        const structuredChunks = documentChunks.slice(
          startIndex,
          startIndex + 3
        );
        return structuredChunks.map((c) => ({ ...c, score: 1.0 }));
      }
    }
  }

  // --- MODE 2: PENCARIAN SEMANTIK (FALLBACK UNTUK TYPO & PERTANYAAN UMUM) ---
  console.log(
    "[DEBUG] Navigasi gagal (mungkin karena typo atau pertanyaan umum), kembali ke pencarian kemiripan makna."
  );

  const embedder = await EmbeddingSingleton.getInstance();
  const queryEmbedding = await embedder(query, { pooling: "mean" });
  const queryVec = Array.from(queryEmbedding.data);

  const scoredChunks = documentChunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryVec, chunk.embedding),
  }));

  scoredChunks.sort((a, b) => b.score - a.score);

  return scoredChunks.slice(0, topK);
}

// BAGIAN MIDDLEWARENYA WOK
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  session({
    secret: "SxvxnTSPMO",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// DATABASE DATABASEAN
const db = new sqlite3.Database("admin.db", (err) => {
  if (err) console.error("SQLite error:", err.message);
  else console.log("Terhubung ke database admin.db");
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
  );
});

// CHAT TAPI PAKE RAG XENOVA (NYARI DATA RELEVAN GITU)
// GANTI TOTAL ENDPOINT /chat DENGAN VERSI SEDERHANA INI
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ reply: "Mohon masukkan pesan yang valid" });
  }

  try {
    // Cukup panggil findRelevantChunks, semua keajaiban terjadi di sana
    const relevantChunks = await findRelevantChunks(message);

    let fileContext = "Konteks tidak ditemukan dalam dokumen.";
    if (relevantChunks.length > 0) {
      fileContext = relevantChunks
        .map((chunk) => chunk.content)
        .join("\n\n---\n\n");
    }

    console.log(`\n[DEBUG] Pertanyaan: "${message}"`);
    console.log(
      `[DEBUG] Konteks yang dikirim ke AI:\n---\n${fileContext}\n---`
    );

    const finalSystemPrompt = `${SYSTEM_PROMPT}\n\n--- KONTEKS RELEVAN ---\n${fileContext}`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3-0324:free",
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: message },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      }
    );

    const data = await response.json();
    let reply =
      data.choices?.[0]?.message?.content ||
      "Maaf, saya tidak bisa memberikan jawaban saat ini.";

    const contactInfo = `\n\nUntuk info lebih lanjut Mengenai Kominfotik Jakarta Timur:\n☎️ Call Center: 0821-2509-6819\n💌 Email: kominfotikjt@jakarta.go.id\n🏢 Lokasi Kantor: Blok B1 lantai 3 Kantor Wali Kota Jakarta Timur RT.11, RT.11/RW.8, Pulo Gebang, Cakung, Kota Jakarta Timur, Jakarta 13950\n🌐 Website resmi: https://kominfotikjt.jakarta.go.id/\n▶️ Youtube: www.youtube.com/@KotaJakartaTimur `;
    reply += contactInfo;
    reply = reply
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/__(.*?)__/g, "<b>$1</b>");
    reply = reply.replace(/\n/g, "<br>");

    res.json({ reply });
  } catch (err) {
    console.error("Error di /chat:", err);
    res.status(500).json({ reply: "Maaf, terjadi gangguan teknis." });
  }
});

// ROUTING ROUTING
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });
app.post("/upload-multiple", upload.array("files"), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("Tidak ada file yang diupload.");
  }
  console.log(
    "File baru diupload. Untuk menerapkan perubahan, silakan restart server."
  );
  res
    .status(200)
    .send(
      `File berhasil diupload: ${req.files
        .map((f) => f.originalname)
        .join(", ")}`
    );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM admin WHERE username = ? AND password = ?",
    [username, password],
    (err, row) => {
      if (err || !row) {
        return res.redirect("/login?failed=1");
      }
      req.session.loggedIn = true;
      req.session.username = row.username;
      res.redirect("/dashboard");
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Gagal logout");
    res.redirect("/login");
  });
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Username dan password harus diisi" });
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, password],
    function (err) {
      if (err)
        return res.status(400).json({ error: "Username sudah digunakan" });
      res.json({ success: true, message: "Registrasi berhasil" });
    }
  );
});

app.post("/login-user", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ success: false, error: "Input tidak lengkap" });
  db.get(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, user) => {
      if (err || !user)
        return res
          .status(401)
          .json({ success: false, error: "Username atau password salah" });
      req.session.user = { id: user.id, username: user.username };
      res.json({ success: true, redirect: "index.html" });
    }
  );
});

// LOGIN PAKE GOOGLE PERLU HANDLER LAGI JIRR
app.post("/login-google", (req, res) => {
  const { email, sub } = req.body;

  if (!email || !sub) {
    return res
      .status(400)
      .json({ success: false, error: "Data Google tidak lengkap." });
  }

  db.get("SELECT * FROM users WHERE username = ?", [email], (err, user) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, error: "Terjadi kesalahan pada server." });
    }

    if (user) {
      req.session.user = { id: user.id, username: user.username };
      req.session.save(() => {
        res.json({ success: true, redirect: "index.html" });
      });
    } else {
      const newUsername = email;
      const dummyPassword = sub;

      db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [newUsername, dummyPassword],
        function (err) {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ success: false, error: "Gagal membuat pengguna baru." });
          }

          req.session.user = { id: this.lastID, username: newUsername };
          req.session.save(() => {
            res.json({ success: true, redirect: "index.html" });
          });
        }
      );
    }
  });
});

app.get("/files", (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).json([]);
    const fileList = files.map((file) => ({
      name: file,
      date: fs.statSync(path.join(uploadsDir, file)).mtime,
    }));
    res.json(fileList);
  });
});

app.delete("/files/:filename", (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).send("Gagal menghapus file");
    console.log(
      "File dihapus. Untuk menerapkan perubahan, silakan restart server."
    );
    res.send("File berhasil dihapus");
  });
});

app.get("/api/users", (req, res) => {
  db.all("SELECT * FROM users ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

function requireAdminLogin(req, res, next) {
  if (req.session && req.session.loggedIn) next();
  else res.redirect("/login");
}
function requireUserLogin(req, res, next) {
  if (req.session && req.session.user) next();
  else res.redirect("/user.html");
}

app.get("/dashboard", requireAdminLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/index.html", requireUserLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/", (req, res) => {
  if (req.session && req.session.user) {
    res.redirect("/index.html");
  } else {
    res.sendFile(path.join(__dirname, "public", "user.html"));
  }
});

app.post("/add-admin", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username dan password harus diisi." });
  }

  db.run(
    `INSERT INTO admin (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) {
        console.error("Gagal tambah admin:", err.message);
        return res.status(500).json({
          message: "Gagal menambahkan admin. Username mungkin sudah dipakai.",
        });
      }
      res.json({ message: "Admin berhasil ditambahkan." });
    }
  );
});

app.post("/delete-admin", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username diperlukan." });
  }

  if (req.session.username === username) {
    return res
      .status(403)
      .json({ message: "Anda tidak dapat menghapus akun Anda sendiri." });
  }

  db.run(`DELETE FROM admin WHERE username = ?`, [username], function (err) {
    if (err) {
      console.error("Gagal hapus admin:", err.message);
      return res.status(500).json({ message: "Gagal menghapus admin." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Admin tidak ditemukan." });
    }
    res.json({ message: `Admin ${username} telah dihapus.` });
  });
});

app.get("/admin-list", (req, res) => {
  db.all(`SELECT id, username FROM admin`, (err, rows) => {
    if (err) {
      console.error("Gagal mengambil data admin:", err.message);
      return res.status(500).json({ message: "Gagal mengambil data admin." });
    }
    res.json(rows);
  });
});

// INDEXING DLU KALO PAKE XENOVA
console.log("INDEXING DOKUMEN");
indexPdfs()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SERVER SUDAH BERJALAN DI :  http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Gagal memulai server:", err);
  });

app.post("/reset-password", (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "Username dan password baru wajib diisi.",
    });
  }

  // Validasi password minimal 8 karakter, ada huruf besar, kecil, angka, simbol
  const isValid =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(
      newPassword
    );
  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: "Password tidak memenuhi standar keamanan.",
    });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err)
      return res.status(500).json({ success: false, error: "Database error." });
    if (!user)
      return res
        .status(404)
        .json({ success: false, error: "User tidak ditemukan" });

    db.run(
      "UPDATE users SET password = ? WHERE username = ?",
      [newPassword, username],
      function (err) {
        if (err)
          return res
            .status(500)
            .json({ success: false, error: "Gagal update password." });
        res.json({ success: true, message: "Password berhasil diubah." });
      }
    );
  });
});
