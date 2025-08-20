// server.js
import express from "express";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { verifyToken } from "./utils/token.js"; // Import verifyToken function
import cookieParser from "cookie-parser";
import { dirname } from "path";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoute.js"; // Import auth routes
import webRoutes from "./routes/webRoute.js"; // Import web routes

dotenv.config({ path: "./api.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "http://localhost:3000", // ganti sesuai origin frontend
  credentials: true
})); // Allow credentials for CORS
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use(cookieParser()); // Middleware untuk mengakses cookies
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "private"));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
// Mount routes
app.use("/", authRoutes); // <--- PENTING! Sekarang /register & /login aktif
app.use("/api", webRoutes); // Mount auth routes under /api

// Halaman HTML
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/change-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "change-password.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html")); // DIUBAH
});

app.get("/edit-profile", (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyToken(token);
  if (!decoded) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public", "edit-profile.html"));
}); 

app.get("/faq", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "faq.html")); 
});

app.get("/dashboard", (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyToken(token);
  if (!decoded) return res.redirect("/admin");

  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/chat", (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyToken(token);
  if (!decoded) return res.redirect("/login");

  res.sendFile(path.join(__dirname, "private", "index.html"));
});

app.get("/", (req, res) => {
  // Selalu sajikan landing.html sebagai halaman utama
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

});
