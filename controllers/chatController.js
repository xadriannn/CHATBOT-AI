import { findRelevantChunks } from "../services/documentService.js";
import { askAI } from "../services/aiService.js";

// System prompt ini HANYA berisi peran dan aturan main AI.
const SYSTEM_PROMPT = `
Anda adalah Si Jete, chatbot AI dari Suku Dinas Komunikasi, Informatika dan Statistik (Kominfotik) Kota Administrasi Jakarta Timur. Anda sangat ramah, membantu, dan informatif.
Tugas utama Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan informasi dari "KONTEKS" yang disediakan.
Jangan pernah menggunakan pengetahuan eksternal atau informasi di luar konteks yang diberikan.
Jika jawaban tidak dapat ditemukan di dalam konteks, jawab dengan jujur dan sopan: "Maaf, saya tidak dapat menemukan informasi mengenai hal tersebut di dalam dokumen yang tersedia."
Selalu berkomunikasi dalam Bahasa Indonesia yang baik dan benar.
`;

export async function chatHandler(req, res) {
  // Gunakan nama 'userQuery' agar lebih jelas
  const { message: userQuery } = req.body;
  
  if (!userQuery) {
    return res.status(400).json({ reply: "Pesan tidak boleh kosong." });
  }

  try {
    // 1. Dapatkan konteks yang relevan dari dokumen
    const relevantChunks = await findRelevantChunks(userQuery);

    const context = relevantChunks.length > 0
      ? relevantChunks.map(chunk => chunk.content).join("\n---\n")
      : "Tidak ada informasi relevan yang ditemukan dalam dokumen.";

    // 2. Susun pesan untuk pengguna yang berisi KONTEKS dan PERTANYAAN
    const userMessage = `
      Berdasarkan konteks di bawah ini, jawab pertanyaan pengguna dengan akurat.

      --- KONTEKS ---
      ${context}
      
      --- PERTANYAAN PENGGUNA ---
      ${userQuery}
    `;

    // 3. Panggil AI dengan DUA argumen terpisah: systemPrompt dan userMessage
    const reply = await askAI(
      SYSTEM_PROMPT, 
      userMessage, 
      process.env.GROQ_API_KEY
    );

    res.json({ reply });

  } catch (error) {
    console.error("Error di chat handler:", error);
    res.status(500).json({ reply: "Terjadi kesalahan pada server saat memproses permintaan Anda." });
  }
}