import db from "../config/db.js";

export async function getFaqs(req, res) {
  db.all("SELECT * FROM faqs ORDER BY sort_order ASC, id ASC", [], (err, rows) => {
    if (err) {
      console.error("Gagal mengambil data FAQ:", err);
      return res.status(500).json({ success: false, error: "Gagal mengambil data." });
    }
    res.json({ success: true, faqs: rows });
  });
}

export async function createFaqs(req, res) {
   const { question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ success: false, error: "Pertanyaan dan jawaban harus diisi." });
  }
  db.run("INSERT INTO faqs (question, answer) VALUES (?, ?)", [question, answer], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: "Gagal menyimpan FAQ." });
    }
    res.json({ success: true, message: "FAQ berhasil ditambahkan." });
  });
}

export async function deleteFaq(req, res) {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: "ID FAQ harus diisi." });
  }
  db.run("DELETE FROM faqs WHERE id = ?", [id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: "Gagal menghapus FAQ." });
    }
    res.json({ success: true, message: "FAQ berhasil dihapus." });
  });
}

export async function updateFaq(req, res) {
  const { id, question, answer } = req.body;
  if (!id || !question || !answer) {
    return res.status(400).json({ success: false, error: "Data tidak lengkap." });
  }
  db.run("UPDATE faqs SET question = ?, answer = ? WHERE id = ?", [question, answer, id], function(err) {
    if (err) {
      console.error("DB error saat update FAQ:", err);
      return res.status(500).json({ success: false, error: "Gagal memperbarui FAQ." });
    }
    res.json({ success: true, message: "FAQ berhasil diperbarui." });
  });
}