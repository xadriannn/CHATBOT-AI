import fs from "fs";
import path from "path";
import { uploadsDir } from "../config/multer.js";
import e from "express";

export async function uploadedFile(req, res) {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).json([]);

    const fileList = files.map((file) => ({
      name: file,
      date: fs.statSync(path.join(uploadsDir, file)).mtime, // mtime = last modified time
    }));

    res.json(fileList);
  });
}

export async function uploadFile(req, res) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("Tidak ada file yang diupload.");
  }

  console.log(
    "File baru diupload. Untuk menerapkan perubahan, silakan restart server."
  );

  res.status(200).send(
    `File berhasil diupload: ${req.files.map((f) => f.originalname).join(", ")}`
  );
}

export async function deleteFile(req, res) {
    const filePath = path.join(uploadsDir, req.params.filename);
      fs.unlink(filePath, (err) => {
        if (err) return res.status(500).send("Gagal menghapus file");
        console.log(
          "File dihapus. Untuk menerapkan perubahan, silakan restart server."
        );
        res.send("File berhasil dihapus");
      });
}
