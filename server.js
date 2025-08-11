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
import bcrypt from "bcrypt";
const saltRounds = 10;

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
// Fungsi indexPdfs untuk mengindeks dokumen PDF dan TXT
async function indexPdfs() {
  console.log("Memulai proses indexing dokumen...");
  const embedder = await EmbeddingSingleton.getInstance();

  if (!fs.existsSync(uploadsDir)) {
    console.log("Direktori 'uploads' tidak ditemukan.");
    return;
  }

  const files = fs.readdirSync(uploadsDir);
  documentChunks = [];

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
        const chunkSize = 1500;
        const finalChunks = [];
        let currentChunkContent = "";

        const lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        for (const line of lines) {
          if (
            currentChunkContent.length > 0 &&
            currentChunkContent.length + line.length + 1 > chunkSize
          ) {
            finalChunks.push(currentChunkContent);
            currentChunkContent = "";
          }
          currentChunkContent += (currentChunkContent ? " " : "") + line;
        }

        if (currentChunkContent.length > 0) {
          finalChunks.push(currentChunkContent);
        }

        for (const chunkContent of finalChunks) {
          const embedding = await embedder(chunkContent, { pooling: "mean" });
          documentChunks.push({
            source: file,
            content: chunkContent,
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

// Fungsi findRelevantChunks untuk mencari potongan dokumen yang relevan
async function findRelevantChunks(query, topK = 8) {
  if (documentChunks.length === 0) return [];
  console.log("[DEBUG] Menjalankan pencarian kemiripan makna murni...");

  const embedder = await EmbeddingSingleton.getInstance();
  const queryEmbedding = await embedder(query, { pooling: "mean" });
  const queryVec = Array.from(queryEmbedding.data);

  const scoredChunks = documentChunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryVec, chunk.embedding),
  }));

  scoredChunks.sort((a, b) => b.score - a.score);

  return scoredChunks.slice(0, topK).filter((c) => c.score > 0.25);
}

// BAGIAN MIDDLEWARENYA WOK
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "private"));
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
    `CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY, 
    username TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL)`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY, 
    username TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL, 
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
  );
});

// CHAT TAPI PAKE RAG XENOVA (NYARI DATA RELEVAN GITU)
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

// Endpoint baru untuk Admin Login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM admin WHERE username = ? AND password = ?",
    [username, password],
    (err, row) => {
      if (err) {
        console.error("Database error on admin login:", err);
        return res
          .status(500)
          .json({ success: false, message: "Terjadi kesalahan pada server." });
      }

      if (!row) {
        return res
          .status(401)
          .json({ success: false, message: "Username atau password salah." });
      }

      req.session.loggedIn = true;
      req.session.username = row.username;
      res
        .status(200)
        .json({ success: true, message: "Login berhasil! Mengarahkan..." });
    }
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).send("Gagal logout");
    res.redirect("/login");
  });
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Validasi input kosong
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "Username, email, dan password harus diisi.",
    });
  }

  // Validasi format username
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({
      success: false,
      error: "Username mengandung karakter tidak valid.",
    });
  }

  // Validasi format email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Format email tidak valid.",
    });
  }

  // Validasi kekuatan password (minimal 8 karakter, ada huruf besar, kecil, angka, simbol)
  const passwordValid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!passwordValid) {
    return res.status(400).json({
      success: false,
      error: "Password tidak memenuhi syarat keamanan.",
    });
  }

  try {
    // Cek apakah username atau email sudah digunakan
    db.get(
      `SELECT * FROM users WHERE username = ? OR email = ?`,
      [username, email],
      async (err, user) => {
        if (err) {
          console.error("DB error saat cek user:", err);
          return res.status(500).json({
            success: false,
            error: "Terjadi kesalahan saat memproses data.",
          });
        }

        if (user) {
          return res.status(400).json({
            success: false,
            error: "Username atau email sudah digunakan.",
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Simpan ke database
        db.run(
          `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
          [username, email, hashedPassword],
          function (err) {
            if (err) {
              console.error("DB error saat insert user:", err);
              return res.status(500).json({
                success: false,
                error: "Gagal menyimpan data pengguna.",
              });
            }

            return res.json({
              success: true,
              message: "Registrasi berhasil!",
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Error hashing password:", err);
    return res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
});

// Endpoint baru untuk User Login
app.post("/login", (req, res) => {
  const { loginIdentifier, password } = req.body;

  // Validasi awal
  if (!loginIdentifier || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Input tidak lengkap" });
  }

  const query = `SELECT * FROM users WHERE username = ? OR email = ?`;

  db.get(query, [loginIdentifier, loginIdentifier], async (err, user) => {
    if (err) {
      console.error("DB error:", err);
      return res
        .status(500)
        .json({ success: false, error: "Terjadi kesalahan server." });
    }

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Username/email atau password salah." });
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({
            success: false,
            error: "Username/email atau password salah.",
          });
      }

      // Set session login
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      res.json({ success: true, redirect: "/chat" });
    } catch (err) {
      console.error("Error saat validasi password:", err);
      res
        .status(500)
        .json({ success: false, error: "Terjadi kesalahan saat verifikasi." });
    }
  });
});

// LOGIN PAKE GOOGLE PERLU HANDLER LAGI JIRR
app.post("/login-google", (req, res) => {
  const { email, sub, name } = req.body; // Ambil juga 'name' untuk username yg lebih baik

  if (!email || !sub) {
    return res
      .status(400)
      .json({ success: false, error: "Data Google tidak lengkap." });
  }

  // Cari pengguna berdasarkan kolom 'email', bukan 'username'
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, error: "Terjadi kesalahan pada server." });
    }

    if (user) {
      // Jika user ditemukan berdasarkan email, langsung login
      req.session.user = { id: user.id, username: user.username };
      req.session.save(() => {
        res.json({ success: true, redirect: "/chat" });
      });
    } else {
      // Jika user belum ada, buat akun baru
      try {
        // DIUBAH: Buat username yg lebih baik dan pastikan unik
        let newUsername =
          name.split(" ")[0].toLowerCase() + Math.floor(Math.random() * 1000);

        // DIUBAH: Hash password dummy (dari 'sub' Google) agar konsisten aman
        const dummyHashedPassword = await bcrypt.hash(sub, saltRounds);

        // DIUBAH: Insert ke kolom username, email, dan password
        db.run(
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
          [newUsername, email, dummyHashedPassword],
          function (err) {
            if (err) {
              console.error(err);
              return res.status(500).json({
                success: false,
                error: "Gagal membuat pengguna baru.",
              });
            }

            req.session.user = { id: this.lastID, username: newUsername };
            req.session.save(() => {
              res.json({ success: true, redirect: "/chat" });
            });
          }
        );
      } catch (hashError) {
        console.error("Error hashing dummy password:", hashError);
        res
          .status(500)
          .json({ success: false, error: "Gagal mengamankan akun baru." });
      }
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
  else res.redirect("/admin");
}
function requireUserLogin(req, res, next) {
  if (req.session && req.session.user) next();
  else res.redirect("/login");
}

app.get("/dashboard", requireAdminLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/chat", requireUserLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "index.html"));
});

app.get("/api/get-user-data", requireUserLogin, (req, res) => {
  res.json({
    success: true,
    user: req.session.user,
  });
});

app.post("/api/update-profile", requireUserLogin, async (req, res) => {
  const { username, email, password } = req.body;
  const userId = req.session.user.id;

  if (!username || !email) {
    return res.status(400).json({ success: false, error: "Username dan email tidak boleh kosong." });
  }

  try {
    // Cek apakah username/email baru sudah digunakan oleh user lain
    const existingUser = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE (username = ? OR email = ?) AND id != ?", [username, email, userId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: "Username atau email sudah digunakan oleh pengguna lain." });
    }

    // Jika password diisi, hash password baru
    if (password) {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      db.run("UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?", [username, email, hashedPassword, userId], function(err) {
        if (err) throw err;
      });
    } else {
      // Jika password kosong, update username dan email saja
      db.run("UPDATE users SET username = ?, email = ? WHERE id = ?", [username, email, userId], function(err) {
        if (err) throw err;
      });
    }

    // Perbarui data di sesi
    req.session.user.username = username;
    req.session.user.email = email;
    req.session.save();

    res.json({ success: true, message: "Profil berhasil diperbarui!" });

  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ success: false, error: "Terjadi kesalahan pada server." });
  }
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html")); // DIUBAH
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/change-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "change-password.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html")); // DIUBAH
});

app.get("/", (req, res) => {
  if (req.session && req.session.user) {
    res.redirect("/chat");
  } else {
    res.sendFile(path.join(__dirname, "public", "login.html")); // DIUBAH
  }
});

app.get("/edit-profile", requireUserLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "edit-profile.html")); 
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

app.post("/reset-password", async (req, res) => {
  // jadikan async
  const { email, newPassword } = req.body; // Gunakan email untuk identifikasi
  if (!email || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "Email dan password baru wajib diisi.",
    });
  }

  // Anda bisa tambahkan validasi password yang lebih kompleks di sini

  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User dengan email tersebut tidak ditemukan",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    db.run(
      "UPDATE users SET password = ? WHERE email = ?",
      [hashedPassword, email],
      function (err) {
        if (err) {
          return res
            .status(500)
            .json({ success: false, error: "Gagal update password." });
        }
        res.json({ success: true, message: "Password berhasil diubah." });
      }
    );
  } catch (err) {
    res
      .status(500)
      .json({ success: false, error: "Terjadi kesalahan pada server." });
  }
});
