import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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'
const SYSTEM_PROMPT = `
Anda adalah Chatbot Resmi Kominfo Jakarta Timur. 
Tugas Anda adalah memberikan informasi yang akurat dan membantu masyarakat.
Gunakan bahasa Indonesia yang baik, ramah, dan mudah dimengerti.
Jika tidak tahu jawabannya, sarankan untuk menghubungi:
- Call Center: 021-12345678
- Email: info@kominfo-jaktim.go.id
- Lokasi Kantor: Jl. Raya Bogor KM 24, Jakarta Timur
`;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simpan history percakapan
const conversationHistory = new Map();

app.post('/chat', async (req, res) => {
    const { message, sessionId = 'default' } = req.body;
    
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ 
            reply: "Mohon masukkan pesan yang valid" 
        });
    }

    try {
        // Dapatkan atau buat history percakapan
        if (!conversationHistory.has(sessionId)) {
            conversationHistory.set(sessionId, [
                { role: 'system', content: SYSTEM_PROMPT }
            ]);
        }
        
        const messages = conversationHistory.get(sessionId);
        messages.push({ role: 'user', content: message });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: messages,
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || 
                     "Maaf, saya tidak bisa memberikan jawaban saat ini. Silakan coba lagi nanti.";
        
        // Simpan balasan ke history
        messages.push({ role: 'assistant', content: reply });
        
        res.json({ reply });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ 
            reply: "Maaf, terjadi gangguan teknis. Silakan hubungi Call Center kami di 021-12345678." 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});