import fs from "fs";
import path from "path";
import multer from "multer";

const uploadsDir = path.join(process.cwd(), "uploads");

// Pastikan folder uploads ada
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});

export const upload = multer({ storage });
export { uploadsDir };
