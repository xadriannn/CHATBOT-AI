document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Pesan pembuka dari bot
    setTimeout(() => {
        addBotMessage("Halo! Saya Chatbot Resmi Kominfo Jakarta Timur. Ada yang bisa saya bantu hari ini?");
    }, 800);
    
    // Fungsi untuk menambahkan pesan bot
    function addBotMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot-message');
        messageDiv.textContent = text;
        messageDiv.setAttribute('role', 'text');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Fungsi untuk menambahkan pesan user
    function addUserMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'user-message');
        messageDiv.textContent = text;
        messageDiv.setAttribute('role', 'text');
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Fungsi untuk menampilkan indikator loading
    function showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'bot-message');
        loadingDiv.innerHTML = '<div class="loading" aria-hidden="true"></div>';
        loadingDiv.setAttribute('aria-label', 'Bot sedang mengetik');
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return loadingDiv;
    }
    
    // Fungsi untuk mengirim pesan
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
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Fokus otomatis ke input saat halaman dimuat
    userInput.focus();
});