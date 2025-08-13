export async function askAI(systemPrompt, userMessage, OPENROUTER_API_KEY) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  const data = await response.json();
  let reply = data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa memberikan jawaban saat ini.";

  const contactInfo = `
Untuk info lebih lanjut Mengenai Kominfotik Jakarta Timur:
☎️ Call Center: 0821-2509-6819
💌 Email: kominfotikjt@jakarta.go.id
🏢 Lokasi Kantor: Blok B1 lantai 3 Kantor Wali Kota Jakarta Timur
🌐 Website resmi: https://kominfotikjt.jakarta.go.id/
▶️ Youtube: www.youtube.com/@KotaJakartaTimur`;

  reply += contactInfo;
  return reply.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}
