document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('edit-profile-form');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const submitButton = form.querySelector('button[type="submit"]');

    // Variabel untuk menyimpan nilai asli form
    let originalUsername = '';
    let originalEmail = '';

    // --- 1. Ambil data user saat ini dan isi form ---
    try {
        const res = await fetch('/api/get-user-data', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' // penting untuk kirim cookie JWT
        });
        const data = await res.json();

        if (data.success && data.user) {
            usernameInput.value = data.user.username;
            emailInput.value = data.user.email || '';

            originalUsername = data.user.username;
            originalEmail = data.user.email || '';

            submitButton.disabled = true;

        } else {
            PopupNotify.failed('Gagal memuat data profil. Silakan coba lagi.', 'Error');
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        PopupNotify.failed('Terjadi kesalahan koneksi.', 'Error');
    }

    // Fungsi untuk memeriksa apakah ada perubahan pada form
    function checkForChanges() {
        const usernameChanged = usernameInput.value !== originalUsername;
        const emailChanged = emailInput.value !== originalEmail;
        const passwordTyped = newPasswordInput.value.length > 0;

        if (usernameChanged || emailChanged || passwordTyped) {
            submitButton.disabled = false;
        } else {
            submitButton.disabled = true;
        }
    }

    const inputs = [usernameInput, emailInput, newPasswordInput, confirmPasswordInput];
    inputs.forEach(input => {
        input.addEventListener('input', checkForChanges);
    });


    // --- 2. Tangani submit form untuk update data ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validasi input kosong
        if (!usernameInput.value.trim()) {
            PopupNotify.info('Username tidak boleh kosong.', 'Input Diperlukan');
            return;
        }
        if (!emailInput.value.trim()) {
            PopupNotify.info('Email tidak boleh kosong.', 'Input Diperlukan');
            return;
        }
        
        // Validasi password
        if (newPasswordInput.value !== confirmPasswordInput.value) {
            PopupNotify.failed('Konfirmasi password baru tidak cocok.', 'Password Salah');
            return;
        }

        const updatedData = {
            username: usernameInput.value,
            email: emailInput.value,
            password: newPasswordInput.value || null 
        };

        try {
            const res = await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // penting untuk kirim cookie JWT
                body: JSON.stringify(updatedData)
            });

            const result = await res.json();

            if (result.success) {
                PopupNotify.success(result.message || 'Profil berhasil diperbarui!');
                originalUsername = updatedData.username;
                originalEmail = updatedData.email;
                
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                submitButton.disabled = true;

            } else {
                PopupNotify.failed(result.error || 'Gagal memperbarui profil.');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            PopupNotify.failed('Terjadi kesalahan koneksi saat update.', 'Error');
        }
    });
});