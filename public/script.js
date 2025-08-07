document.addEventListener("DOMContentLoaded", function () {
  // --- Elemen Khusus Halaman Chat ---
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  // Pastikan kita berada di halaman chat sebelum menjalankan kode apa pun
  if (!chatMessages || !userInput || !sendButton) {
    // Jika elemen chat tidak ditemukan, hentikan eksekusi skrip ini.
    // Ini mencegah error saat skrip ini tidak sengaja termuat di halaman lain.
    return; 
  }

  // --- Logika Khusus Halaman Chat ---

  // Pesan pembuka dari bot
  setTimeout(() => {
    addBotMessage(
      "Halo Saya Si Jete! Chatbot Resmi Kominfotik Jakarta Timur. Ada yang bisa saya bantu hari ini?"
    );
  }, 500);

  function addBotMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "bot-message");
    // Parsing sederhana untuk bold (**) dan newline (<br>)
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
    formattedText = formattedText.replace(/\n/g, "<br>");
    messageDiv.innerHTML = formattedText;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addUserMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "user-message");
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("message", "bot-message");
    loadingDiv.innerHTML = `
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>`;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return loadingDiv;
  }

  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addUserMessage(message);
    userInput.value = "";
    userInput.focus();

    const loadingIndicator = showLoading();

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      chatMessages.removeChild(loadingIndicator);
      addBotMessage(data.reply);
    } catch (error) {
      chatMessages.removeChild(loadingIndicator);
      addBotMessage(
        "Maaf, terjadi gangguan koneksi. Silakan coba lagi beberapa saat."
      );
      console.error("Error:", error);
    }
  }

  sendButton.addEventListener("click", sendMessage);

  userInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  userInput.focus();
});