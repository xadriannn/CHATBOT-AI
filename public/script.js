document.addEventListener('DOMContentLoaded', function () {
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const fileInput = document.getElementById('file-input');
  const fileNameDisplay = document.getElementById('file-name');
  const removeFileBtn = document.getElementById('remove-file');
  const alertBox = document.getElementById('alertBox');
  const urlParams = new URLSearchParams(window.location.search);
  const failed = urlParams.get('failed');
  const form = document.getElementById('loginForm');

  // ✅ Simpan username ke localStorage saat login
  if (form) {
    form.addEventListener('submit', function () {
      const username = form.elements['username'].value;
      localStorage.setItem('adminName', username);
    });
  }

  // ✅ Tampilkan alert jika login gagal
  if (failed === '1' && alertBox) {
    alertBox.style.display = 'block';
    setTimeout(() => {
      alertBox.classList.add('fade-out');
    }, 3000);
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 4000);
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const file = fileInput.files[0];
      if (file) {
        fileNameDisplay.textContent = `📃 ${file.name}`;
        removeFileBtn.classList.remove('hidden');
      }
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', function () {
      fileInput.value = '';
      fileNameDisplay.textContent = '';
      removeFileBtn.classList.add('hidden');
    });
  }

  // ✅ Pesan pembuka dari bot
  if (chatMessages) {
    setTimeout(() => {
      addBotMessage("Halo Saya Si Zecky! Chatbot Resmi Kominfotik Jakarta Timur. Ada yang bisa saya bantu hari ini?");
    }, 500);
  }

  function parseMarkdown(text) {
    return text
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>');
  }

  function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot-message');
    messageDiv.innerHTML = parseMarkdown(text);
    messageDiv.setAttribute('role', 'text');
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'user-message');
    messageDiv.textContent = text;
    messageDiv.setAttribute('role', 'text');
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('message', 'bot-message');
    loadingDiv.innerHTML = '<div class="loading" aria-hidden="true"></div>';
    loadingDiv.setAttribute('aria-label', 'Bot sedang mengetik');
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return loadingDiv;
  }

  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addUserMessage(message);
    userInput.value = '';
    userInput.focus();

    const loadingIndicator = showLoading();

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      chatMessages.removeChild(loadingIndicator);
      addBotMessage(data.reply);
    } catch (error) {
      chatMessages.removeChild(loadingIndicator);
      addBotMessage("Maaf, terjadi gangguan koneksi. Silakan coba lagi beberapa saat.");
      console.error('Error:', error);
    }
  }

  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }

  if (userInput) {
    userInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    userInput.focus();
  }
});

// ✅ Logout bersihkan localStorage
function logout() {
  localStorage.removeItem('adminName');
  window.location.href = 'login.html';
}

// ✅ Navigasi antar section
function showSection(sectionId, link) {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden-section'));
  document.getElementById(sectionId).classList.remove('hidden-section');
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  link.classList.add('active');
}

// ✅ Chart pengguna
const ctx = document.getElementById('userChart')?.getContext('2d');
if (ctx) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [{
        label: 'User Baru',
        data: [12, 19, 10, 17, 25, 18, 22],
        borderColor: '#2563eb',
        fill: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
      }
    }
  });
}

// ✅ Chart chat volume
const ctx2 = document.getElementById('chatVolumeChart')?.getContext('2d');
if (ctx2) {
  new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      datasets: [{
        label: 'Jumlah Chat',
        data: [50, 45, 60, 38, 70, 33, 40],
        backgroundColor: '#1e40af'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      }
    }
  });
}

// ✅ Tampilkan greeting admin di dashboard
document.addEventListener('DOMContentLoaded', () => {
  const storedName = localStorage.getItem('adminName');
  const nameSpan = document.getElementById('admin-username');
  if (storedName && nameSpan) {
    const capitalized = storedName.charAt(0).toUpperCase() + storedName.slice(1);
    nameSpan.textContent = capitalized;
  }
});
