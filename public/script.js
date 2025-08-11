// File: public/script.js

document.addEventListener("DOMContentLoaded", async function () {
  // --- Ambil Elemen ---
  const desktopGreeting = document.getElementById("greeting-text-desktop");
  const mobileGreeting = document.getElementById("greeting-text-mobile");
  const profileButton = document.getElementById("profile-button");
  const profileDropdown = document.getElementById("profile-dropdown");
  const logoutButton = document.getElementById("logout-button");
  const chatMessages = document.getElementById("chat-messages");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");

  // --- Logika untuk Header (Sapaan, Dropdown, Logout) ---

  // 1. Ambil dan tampilkan nama pengguna
  try {
    const response = await fetch("/api/get-user-data");
    const data = await response.json();
    if (data.success && data.user && data.user.username) {
      const username = data.user.username;
      const now = new Date();
      const hour = now.getHours();
      let greeting;
      if (hour >= 4 && hour <= 10) {
        greeting = "Selamat Pagi";
      } else if (hour >= 11 && hour <= 14) {
        greeting = "Selamat Siang";
      } else if (hour >= 15 && hour <= 17) {
        greeting = "Selamat Sore";
      } else {
        greeting = "Selamat Malam";
      }
      const greetingMessage = `${greeting}, ${username}`;

      // Cek elemen ada sebelum diisi untuk menghindari error
      if (desktopGreeting) desktopGreeting.textContent = greetingMessage;
      if (mobileGreeting) mobileGreeting.textContent = greetingMessage;
    } else {
      console.error("Gagal mengambil data user dari server.", data.error || "");
    }
  } catch (error) {
    console.error("Terjadi error saat fetching data user:", error);
  }

  // 2. Logika untuk menu dropdown
  if (profileButton && profileDropdown) {
    profileButton.addEventListener("click", function (event) {
      event.stopPropagation();
      profileDropdown.classList.toggle("show");
    });
    window.addEventListener("click", function (event) {
      if (
        !profileButton.contains(event.target) &&
        !profileDropdown.contains(event.target)
      ) {
        profileDropdown.classList.remove("show");
      }
    });
  }

  const submenuToggle = document.querySelector(".submenu-toggle");
  if (submenuToggle) {
    submenuToggle.addEventListener("click", function (event) {
      event.stopPropagation(); // Mencegah dropdown utama tertutup

      // Toggle kelas 'open' pada tombol dan submenu
      this.classList.toggle("open");
      const submenu = this.nextElementSibling;
      submenu.classList.toggle("open");
    });
  }

  // 3. Logika Tombol Logout dengan Pop-up
  if (logoutButton) {
    logoutButton.addEventListener("click", async function (event) {
      event.preventDefault(); // Mencegah redirect langsung

      // Panggil fungsi pop-up kustom Anda dari popup-notify.js
      // PopupNotify.confirm() mengembalikan Promise, jadi kita gunakan await
      const isConfirmed = await PopupNotify.confirm(
        "Anda yakin ingin keluar dari sesi ini?",
        "Konfirmasi Logout"
      );

      // Lanjutkan hanya jika pengguna menekan "OK"
      if (isConfirmed) {
        window.location.href = logoutButton.href; // Lakukan redirect ke /logout
      }
    });
  }

  // --- Logika Khusus Mesin Chat ---
  if (!chatMessages || !userInput || !sendButton) {
    return; // Hentikan jika ini bukan halaman chat (sebagai pengaman)
  }

  // Pesan pembuka dari bot
  setTimeout(() => {
    addBotMessage(
      "Halo Saya Si Jete! Chatbot Resmi Kominfotik Jakarta Timur. Ada yang bisa saya bantu hari ini?"
    );
  }, 500);

  function addBotMessage(text) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", "bot-message");
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
    loadingDiv.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
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
