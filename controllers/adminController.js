import db from "../config/db.js";

export async function getAdminList(req, res) {
  try {
    db.all("SELECT username FROM admin", [], async (err, admins) => {
      if (err) {
        console.error("Gagal mengambil admin:", err);
        return res.status(500).send("Gagal mengambil admin");
      }

      // Ambil aktivitas terakhir untuk tiap admin
      const results = await Promise.all(
        admins.map((admin) => {
          return new Promise((resolve) => {
            db.get(
              "SELECT activity, timestamp FROM logs WHERE username = ? ORDER BY timestamp DESC LIMIT 1",
              [admin.username],
              (err, log) => {
                resolve({
                  username: admin.username,
                  lastActivity: log
                    ? `${log.activity} (${log.timestamp})`
                    : "Belum ada aktivitas",
                });
              }
            );
          });
        })
      );

      res.json(results);
    });
  } catch (error) {
    console.error("Error getAdminList:", error);
    res.status(500).send("Terjadi kesalahan pada server");
  }
}

export async function addAdmin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username dan password harus diisi.",
    });
  }

  try {
    db.run(
      `INSERT INTO admin (username, password) VALUES (?, ?)`,
      [username, password],
      function (err) {
        if (err) {
          console.error("Gagal menambahkan admin:", err);
          return res.status(500).json({
            success: false,
            error: "Gagal menambahkan admin.",
          });
        }

        res.json({
          success: true,
          message: "Admin berhasil ditambahkan!",
        });
      }
    );
  } catch (error) {
    console.error("Error addAdmin:", error);
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
}

export async function deleteAdmin(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "Username harus diisi.",
    });
  }

  try {
    db.run(
      `DELETE FROM admin WHERE username = ?`,
      [username],
      function (err) {
        if (err) {
          console.error("Gagal menghapus admin:", err);
          return res.status(500).json({
            success: false,
            error: "Gagal menghapus admin.",
          });
        }

        if (this.changes === 0) {
          return res.status(404).json({
            success: false,
            error: "Admin tidak ditemukan.",
          });
        }

        res.json({
          success: true,
          message: "Admin berhasil dihapus!",
        });
      }
    );
  } catch (error) {
    console.error("Error deleteAdmin:", error);
    res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada server.",
    });
  }
}