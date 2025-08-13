import db from "../config/db.js";
import { generateToken } from "../utils/token.js";
import { hashPassword, comparePassword } from '../utils/hash.js';
import bcrypt from 'bcrypt';

const saltRounds = 10;

export async function register(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "Username, email, dan password harus diisi.",
    });
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({
      success: false,
      error: "Username mengandung karakter tidak valid.",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Format email tidak valid.",
    });
  }

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

        const hashed = await hashPassword(password);

        db.run(
          `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
          [username, email, hashed],
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
}


export async function loginUser(req, res) {
  const { loginIdentifier, password } = req.body;

  if (!loginIdentifier || !password) {
    return res.status(400).json({
      success: false,
      error: "Username atau Email dan password harus diisi.",
    });
  }

  try {
    db.get(
      `SELECT * FROM users WHERE username = ? OR email = ?`,
      [loginIdentifier, loginIdentifier],
      async (err, user) => {
        if (err) {
          console.error("DB error saat cek user:", err);
          return res.status(500).json({
            success: false,
            error: "Terjadi kesalahan saat memproses data.",
          });
        }

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Username/email atau password salah.",
          });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            error: "Username/email atau password salah.",
          });
        }

        // Buat JWT token
        const token = generateToken({ id: user.id, username: user.username });

        // Simpan di cookie HTTP-only
        res.cookie("token", token, {
          httpOnly: true,
          secure: false, // set true kalau HTTPS
          maxAge: 24 * 60 * 60 * 1000 // 1 hari
        });

        // Kirim respon
        return res.json({
          success: true,
          message: "Login berhasil!"
        });
      }
    );
  } catch (err) {
    console.error("Error saat login:", err);
    return res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
}

export async function loginAdmin(req, res) {
  const { username, password } = req.body;

  // Validasi input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username dan password harus diisi.",
    });
  }

  try {
    db.get(
      `SELECT * FROM admin WHERE username = ?`,
      [username],
      async (err, admin) => {
        if (err) {
          console.error("DB error saat cek user:", err);
          return res.status(500).json({
            success: false,
            error: "Terjadi kesalahan saat memproses data.",
          });
        }

        if (!admin) {
          return res.status(401).json({
            success: false,
            error: "Username atau password salah.",
          });
        }

        // Buat JWT token
        const token = generateToken({ id: admin.id, username: admin.username });

        // Simpan token di cookie HTTP-only
        res.cookie("token", token, {
          httpOnly: true,
          secure: false, // set true kalau HTTPS
          maxAge: 24 * 60 * 60 * 1000 // 1 hari
        });

        // Kirim respon sukses
        return res.json({
          success: true,
          message: "Login berhasil!"
        });
      }
    );
  } catch (err) {
    console.error("Error saat login:", err);
    return res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
}

export async function loginGoogle(req, res) {
  const { email, sub, name } = req.body;

  if (!email || !sub) {
    return res.status(400).json({
      success: false,
      error: "Data Google tidak lengkap."
    });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false,
        error: "Terjadi kesalahan pada server."
      });
    }

    const setCookieAndRespond = (id, username, email) => {
      const token = generateToken({ id, username, email });

      // Simpan di cookie HTTP-only (sama seperti loginUser)
      res.cookie("token", token, {
        httpOnly: true,
        secure: false, // true kalau sudah pakai HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 hari
      });

      res.json({
        success: true,
        message: "Login Google berhasil!",
        redirect: "/chat"
      });
    };

    if (user) {
      // User sudah ada
      setCookieAndRespond(user.id, user.username, user.email);
    } else {
      try {
        let newUsername =
          name.split(" ")[0].toLowerCase() + Math.floor(Math.random() * 1000);
        const dummyHashedPassword = await bcrypt.hash(sub, saltRounds);

        db.run(
          "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
          [newUsername, email, dummyHashedPassword],
          function (err) {
            if (err) {
              console.error(err);
              return res.status(500).json({
                success: false,
                error: "Gagal membuat pengguna baru."
              });
            }

            setCookieAndRespond(this.lastID, newUsername, email);
          }
        );
      } catch (hashError) {
        console.error("Error hashing dummy password:", hashError);
        res.status(500).json({
          success: false,
          error: "Gagal mengamankan akun baru."
        });
      }
    }
  });
}


export async function logoutUser(req, res) {
  res.clearCookie("token");
  res.redirect("/login");
}

export async function resetPassword(req, res) {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "Email dan password baru harus diisi.",
    });
  }

  try {
    const hashedPassword = await hashPassword(newPassword);

    db.run(
      `UPDATE users SET password = ? WHERE email = ?`,
      [hashedPassword, email],
      function (err) {
        if (err) {
          console.error("DB error saat update password:", err);
          return res.status(500).json({
            success: false,
            error: "Gagal memperbarui password.",
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            error: "Email tidak ditemukan.",
          });
        }

        return res.json({
          success: true,
          message: "Password berhasil diperbarui!",
        });
      }
    );
  } catch (err) {
    console.error("Error hashing password:", err);
    return res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
}