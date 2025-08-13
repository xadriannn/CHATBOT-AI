import db from "../config/db.js";
import { generateToken } from "../utils/token.js";
import bcrypt from "bcrypt";

export async function getUserList(req, res) {
  try {
    db.all("SELECT username, created_at FROM users", [], (err, users) => {
      if (err) {
        console.error("Gagal mengambil daftar pengguna:", err);
        return res.status(500).send("Gagal mengambil daftar pengguna");
      }

      // langsung kirim tanpa log
      res.json(users);
    });
  } catch (error) {
    console.error("Error getUserList:", error);
    res.status(500).send("Terjadi kesalahan pada server");
  }
}

export async function deleteUser(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "Username harus diisi.",
    });
  }

  try {
    db.run(`DELETE FROM users WHERE username = ?`, [username], function (err) {
      if (err) {
        console.error("Gagal menghapus pengguna:", err);
        return res.status(500).json({
          success: false,
          error: "Gagal menghapus pengguna.",
        });
      }

      res.json({
        success: true,
        message: "Pengguna berhasil dihapus!",
      });
    });
  } catch (error) {
    console.error("Error deleteUser:", error);
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
}

export async function getUserData(req, res) {
  try {
    const userId = req.user.id;

    db.get(
      "SELECT id, username, email FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) {
          console.error("DB Error:", err);
          return res
            .status(500)
            .json({ success: false, error: "Gagal mengambil data pengguna." });
        }
        if (!row) {
          return res
            .status(404)
            .json({ success: false, error: "Pengguna tidak ditemukan." });
        }
        res.json({ success: true, user: row });
      }
    );
  } catch (error) {
    console.error("getUserData error:", error);
    res
      .status(500)
      .json({ success: false, error: "Terjadi kesalahan server." });
  }
}

// Update data user
export async function updateProfile(req, res) {
  try {
    const userId = req.user.id; // Gunakan ID dari JWT
    const { username, email, password } = req.body;

    if (!username || !email) {
      return res
        .status(400)
        .json({ success: false, error: "Username dan email wajib diisi." });
    }

    // Hash password kalau ada
    let hashedPassword = null;
    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    // Update DB
    let query = "UPDATE users SET username = ?, email = ? ";
    const params = [username, email];
    if (hashedPassword) {
      query += ", password = ? ";
      params.push(hashedPassword);
    }
    // Ganti klausa WHERE untuk menggunakan ID pengguna yang unik
    query += "WHERE id = ?";
    params.push(userId);

    db.run(query, params, function (err) {
      if (err) {
        console.error("DB Error:", err);
        return res
          .status(500)
          .json({ success: false, error: "Gagal memperbarui profil." });
      }

      // Pastikan fungsi generateToken Anda menyertakan ID dan data terbaru
      const userPayload = { id: userId, username, email };
      const newToken = generateToken(userPayload);

      res.json({
        success: true,
        message: "Profil berhasil diperbarui.",
        token: newToken,
      });
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res
      .status(500)
      .json({ success: false, error: "Terjadi kesalahan server." });
  }
}
