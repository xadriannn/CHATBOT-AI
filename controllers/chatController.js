import { findRelevantChunks } from "../services/documentService.js";
import { askAI } from "../services/aiService.js";

const SYSTEM_PROMPT = `
Anda adalah Si Jete, chatbot AI dari Kominfotik Jakarta Timur yang ramah dan informatif.
Tugas utama Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan informasi dari "KONTEKS RELEVAN" yang disediakan.
...
`;

export async function chatHandler(req, res) {
  const { message } = req.body;
  if (!message) return res.status(400).json({ reply: "Pesan tidak valid" });

  const relevantChunks = await findRelevantChunks(message);
  const fileContext = relevantChunks.length
    ? relevantChunks.map(c => c.content).join("\n\n---\n\n")
    : "Konteks tidak ditemukan.";

  const finalPrompt = `${SYSTEM_PROMPT}\n\n--- KONTEKS RELEVAN ---\n${fileContext}`;
  const reply = await askAI(finalPrompt, message, process.env.OPENROUTER_API_KEY);
  res.json({ reply });
}
