import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import EmbeddingSingleton, { cosineSimilarity } from "./embeddingService.js";

const uploadsDir = path.join(process.cwd(), "uploads");
let documentChunks = [];

export async function indexPdfs() {
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
        const lines = text.split("\n").map(l => l.trim()).filter(l => l);
        let currentChunk = [];

        for (const line of lines) {
          if (currentChunk.join(" ").length + line.length > chunkSize) {
            await pushChunk(currentChunk.join(" "), file, embedder);
            currentChunk = [];
          }
          currentChunk.push(line);
        }
        if (currentChunk.length > 0) {
          await pushChunk(currentChunk.join(" "), file, embedder);
        }
      }
    } catch (err) {
      console.error(`Gagal memproses file ${file}:`, err);
    }
  }
  console.log(`Indexing selesai. ${documentChunks.length} potongan siap digunakan.`);
}

async function pushChunk(content, file, embedder) {
  const embedding = await embedder(content, { pooling: "mean" });
  documentChunks.push({
    source: file,
    content,
    embedding: Array.from(embedding.data),
  });
}

export async function findRelevantChunks(query, topK = 8) {
  if (documentChunks.length === 0) return [];
  const embedder = await EmbeddingSingleton.getInstance();
  const queryEmbedding = await embedder(query, { pooling: "mean" });
  const queryVec = Array.from(queryEmbedding.data);

  return documentChunks
    .map(chunk => ({ ...chunk, score: cosineSimilarity(queryVec, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(c => c.score > 0.25);
}
