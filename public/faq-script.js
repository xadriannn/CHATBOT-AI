document.addEventListener('DOMContentLoaded', () => {
    const faqContainer = document.getElementById('faq-list-container');

    // Fungsi untuk membuat elemen HTML untuk satu item FAQ
    function createFaqItem(faq) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'faq-item';

        // Mengganti newline (\n) di jawaban dengan tag <br> untuk format HTML
        const formattedAnswer = faq.answer.replace(/\n/g, '<br>');

        itemDiv.innerHTML = `
            <button class="faq-question">
                <span>${faq.question}</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="faq-answer">
                <p>${formattedAnswer}</p>
            </div>
        `;
        return itemDiv;
    }

    // Fungsi untuk memasang event listener pada tombol-tombol pertanyaan
    function attachAccordionListeners() {
        const faqQuestions = document.querySelectorAll('.faq-question');
        faqQuestions.forEach(button => {
            button.addEventListener('click', () => {
                const answer = button.nextElementSibling;
                const wasActive = button.classList.contains('active');

                // Tutup semua item lain terlebih dahulu
                faqQuestions.forEach(btn => {
                    btn.classList.remove('active');
                    btn.nextElementSibling.style.maxHeight = null;
                });

                // Buka item yang diklik (jika sebelumnya tertutup)
                if (!wasActive) {
                    button.classList.add('active');
                    answer.style.maxHeight = answer.scrollHeight + "px";
                }
            });
        });
    }
    
    // Fungsi untuk menjalankan animasi staggered
    function animateItems() {
        const itemsToAnimate = document.querySelectorAll('.faq-item');
        itemsToAnimate.forEach((item, index) => {
            const delay = index * 100; // jeda 100ms per item
            setTimeout(() => {
                item.classList.add('visible');
            }, delay);
        });
    }

    // Fungsi utama untuk memuat semua FAQ dari API
    async function loadFaqs() {
        if (!faqContainer) return;

        faqContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Memuat pertanyaan...</p>';

        try {
            const response = await fetch('/api/faq',{
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            }); // Memanggil API
            const data = await response.json();

            if (data.success && data.faqs.length > 0) {
                faqContainer.innerHTML = ''; // Bersihkan pesan loading
                
                // Buat dan tambahkan setiap elemen FAQ ke dalam wadah
                data.faqs.forEach(faq => {
                    const faqElement = createFaqItem(faq);
                    faqContainer.appendChild(faqElement);
                });

                attachAccordionListeners(); // Pasang listener setelah elemen dibuat
                animateItems();             // Jalankan animasi setelah elemen dibuat

            } else {
                faqContainer.innerHTML = '<p style-="text-align: center; padding: 20px;">Belum ada pertanyaan yang tersedia saat ini.</p>';
            }
        } catch (error) {
            console.error('Gagal memuat FAQ:', error);
            faqContainer.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">Gagal memuat data. Silakan coba lagi nanti.</p>';
        }
    }

    loadFaqs();
});