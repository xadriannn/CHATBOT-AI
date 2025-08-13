document.addEventListener("DOMContentLoaded", () => {
  // ===================================================================
  // FUNGSI UTAMA UNTUK MENAMPILKAN DATA
  // ===================================================================

  let userChartInstance = null;
  let chatVolumeChartInstance = null;

  async function fetchAdminGreeting() {
    try {
      const res = await fetch("/api/get-user-data");
      const data = await res.json();
      if (data.success && data.user && data.user.username) {
        document.getElementById("admin-username").textContent =
          data.user.username;
      } else {
        document.getElementById("admin-username").textContent = "Admin";
      }
    } catch (err) {
      console.error("Gagal mengambil data sapaan admin:", err);
      document.getElementById("admin-username").textContent = "Admin";
    }
  }

  function updateUserStatsAndChart(users) {
    document.getElementById("activeUsers").textContent = users.length;
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = users.filter((u) => {
      if (!u.created_at) return false;
      const userDate = new Date(
        new Date(u.created_at).toLocaleString("en-US", {
          timeZone: "Asia/Bangkok",
        })
      );
      return userDate >= days30Ago;
    });
    document.getElementById("newUsers").textContent = newUsers.length;

    const dateMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      const key =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
      dateMap[key] = 0;
    }
    users.forEach((u) => {
      if (u.created_at) {
        const d = new Date(
          new Date(u.created_at).toLocaleString("en-US", {
            timeZone: "Asia/Bangkok",
          })
        );
        const key =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");
        if (dateMap[key] !== undefined) dateMap[key]++;
      }
    });

    let runningTotal = 0;
    const chartLabels = Object.keys(dateMap);
    const chartData = chartLabels.map((date) => {
      const dailyNewUsers = dateMap[date];
      runningTotal += dailyNewUsers;
      return runningTotal;
    });

    const ctx = document.getElementById("userChart").getContext("2d");
    if (userChartInstance) userChartInstance.destroy();
    userChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Total User",
            data: chartData,
            borderColor: "#007bff",
            backgroundColor: "rgba(0,123,255,0.1)",
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: false } },
        scales: {
          x: { title: { display: true, text: "Tanggal (30 Hari Terakhir)" } },
          y: {
            title: { display: true, text: "Akumulasi Total User" },
            beginAtZero: true,
          },
        },
      },
    });
  }

async function fetchAdmins() {
  try {
    const res = await fetch("/api/admin-list", {
      method: "GET",
      credentials: "include" // penting untuk kirim cookie JWT
    });

    if (!res.ok) throw new Error("Gagal fetch admin list");

    const admins = await res.json();

    const tbody = document.getElementById("admin-table-body");
    tbody.innerHTML = "";

    admins.forEach((admin) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${admin.username}</td>
        <td>${admin.lastActivity}</td>
        <td class="action-cell">
          <button class="danger-btn" onclick="deleteAdmin('${admin.username}')"><i class="fas fa-trash"></i> Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Gagal memuat data admin:", err);
  }
}


  async function logActivity(activity) {
  try {
    await fetch("/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser, activity }) // pastikan currentUser tersedia
    });
  } catch (error) {
    console.error("Gagal mengirim log:", error);
  }
}

async function fetchLogs() {
  try {
    const res = await fetch("/logs");
    const logs = await res.json();
    const tbody = document.getElementById("log-table-body");
    tbody.innerHTML = "";
    logs.forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.username}</td>
        <td>${log.activity}</td>
        <td>${new Date(log.timestamp).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Gagal mengambil log:", err);
  }
}



  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const users = await res.json();
      const tbody = document.getElementById("user-table-body");
      tbody.innerHTML = "";
      users.forEach((user) => {
        const tr = document.createElement("tr");
        let createdAtStr = "-";
        if (user.created_at) {
          const d = new Date(
            new Date(user.created_at).toLocaleString("en-US", {
              timeZone: "Asia/Bangkok",
            })
          );
          createdAtStr =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0") +
            " " +
            d.getHours().toString().padStart(2, "0") +
            ":" +
            d.getMinutes().toString().padStart(2, "0");
        }
        tr.innerHTML = `
          <td><input type="checkbox" class="select-user" value="${user.username}"></td>
          <td>${user.username}</td>
          <td>${createdAtStr}</td>
          <td class="action-cell">
            <button class="danger-btn" onclick="deleteUser('${user.username}')"><i class="fas fa-trash"></i> Hapus</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      updateUserStatsAndChart(users);
    } catch (err) {
      console.error("Gagal memuat data user:", err);
    }
  }

  async function fetchUploadedFiles() {
    try {
      const res = await fetch("/api/files", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include" // penting untuk kirim cookie JWT
    });
      const files = await res.json();
      const tbody = document.getElementById("file-manager-body");
      tbody.innerHTML = "";
      files.forEach((file) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${file.name}</td>
          <td>${new Date(file.date).toLocaleString()}</td>
          <td class="action-cell">
            <div class="file-action-buttons">
              <a href="/uploads/${encodeURIComponent(
                file.name
              )}" download class="primary-btn">Download</a>
              <button class="danger-btn" onclick="deleteFileFromManager('${
                file.name
              }')">
                <i class="fas fa-trash"></i> Hapus
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("Gagal memuat daftar file:", err);
    }
  }

  window.logout = async function () {
    const isConfirmed = await PopupNotify.confirm(
      "Anda akan keluar dari sesi admin dan diarahkan ke halaman login.",
      "Anda yakin ingin logout?"
    );
    if (isConfirmed) {
      window.location.href = "/admin";
    }
  };

  window.deleteAdmin = async function (username) {
    const isConfirmed = await PopupNotify.confirm(
      `Tindakan ini tidak dapat diurungkan.`,
      `Hapus admin ${username}?`
    );
    if (isConfirmed) {
      try {
        const res = await fetch("/api/delete-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // penting untuk kirim cookie JWT
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (res.ok) {
          PopupNotify.success(`Admin ${username} berhasil dihapus.`);
          // ✅ Catat log aktivitas
      await fetch("/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          activity: "Menghapus akun admin"
        })
      });
      
          fetchAdmins();
        } else {
          PopupNotify.failed(data.message || "Gagal menghapus admin.");
        }
      } catch (err) {
        PopupNotify.failed("Terjadi kesalahan pada server.");
      }
    }
  };

  window.deleteUser = async function (username) {
    const isConfirmed = await PopupNotify.confirm(
      `Tindakan ini akan menghapus user ${username} secara permanen.`,
      "Yakin ingin menghapus?"
    );
    if (isConfirmed) {
      try {
        const res = await fetch("/api/delete-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // penting untuk kirim cookie JWT
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          PopupNotify.success(`User ${username} berhasil dihapus.`);
          fetchUsers();
        } else {
          PopupNotify.failed(data.error || "Gagal menghapus user.");
        }
      } catch (err) {
        PopupNotify.failed("Gagal menghapus user, terjadi kesalahan server.");
      }
    }
  };

  window.deleteFileFromManager = async function (filename) {
    const isConfirmed = await PopupNotify.confirm(
      `File "${filename}" akan dihapus secara permanen.`,
      "Yakin ingin menghapus file?"
    );
    if (isConfirmed) {
      try {
        const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // penting untuk kirim cookie JWT
        });
        if (res.ok) {
          PopupNotify.success(`File "${filename}" berhasil dihapus.`);
          fetchUploadedFiles();
        } else {
          PopupNotify.failed("Gagal menghapus file.");
        }
      } catch (err) {
        console.error("Gagal hapus:", err);
        PopupNotify.failed("Kesalahan server saat menghapus file.");
      }
    }
  };

  // ===================================================================
  // FUNGSI INISIALISASI & EVENT LISTENER LAINNYA
  // ===================================================================

  // --- Event Listener untuk Aksi-Aksi di Dashboard ---

  // DIPERBARUI: Hapus user terpilih (checkbox)
  document
    .getElementById("delete-user-button")
    .addEventListener("click", async () => {
      const checked = Array.from(
        document.querySelectorAll(".select-user:checked")
      );
      if (checked.length === 0) {
        PopupNotify.info(
          "Pilih minimal satu user yang ingin dihapus.",
          "Tidak ada user terpilih"
        );
        return;
      }
      const isConfirmed = await PopupNotify.confirm(
        `Anda akan menghapus ${checked.length} user secara permanen.`,
        "Hapus user terpilih?"
      );
      if (isConfirmed) {
        let successCount = 0;
        let failedCount = 0;
        for (const cb of checked) {
          try {
            const res = await fetch("/delete-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: cb.value }),
            });
            if (res.ok) {
              successCount++;
            } else {
              failedCount++;
            }
          } catch {
            failedCount++;
          }
        }
        if (failedCount > 0) {
          PopupNotify.failed(
            `${failedCount} user gagal dihapus.`,
            "Sebagian Gagal"
          );
        } else {
          PopupNotify.success(`${successCount} user berhasil dihapus.`);
        }
        fetchUsers();
      }
    });

  // DIPERBARUI: Menangani Upload Banyak File
  document
    .getElementById("upload-form")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const fileInput = document.getElementById("file-input");
      const statusDiv = document.getElementById("upload-status");

      // --- Validasi di sini ---
      if (!fileInput.files.length) {
        PopupNotify.info("Silakan pilih file terlebih dahulu.", "File Kosong");
        return;
      }

      const formData = new FormData();
      for (let i = 0; i < fileInput.files.length; i++) {
        formData.append("files", fileInput.files[i]);
      }

      statusDiv.textContent = "Mengupload...";
      statusDiv.style.color = "inherit";

      try {
        const res = await fetch("/api/upload-multiple", {
          method: "POST",
          headers: { "Accept": "application/json" },
          credentials: "include", // penting untuk kirim cookie JWT
          body: formData,
        });
        const text = await res.text();
        if (res.ok) {
          PopupNotify.success(
            `${fileInput.files.length} file berhasil diupload.`
          );
          fileInput.value = "";
          statusDiv.textContent = "";
          fetchUploadedFiles();
        } else {
          PopupNotify.failed(text || "Gagal upload file.", "Upload Gagal");
          statusDiv.textContent = "Gagal upload.";
          statusDiv.style.color = "red";
        }
      } catch (err) {
        console.error("Upload error:", err);
        PopupNotify.failed("Terjadi kesalahan saat upload.", "Error");
        statusDiv.textContent = "Terjadi kesalahan.";
        statusDiv.style.color = "red";
      }
    });

  // BARU: Logika untuk Modal Tambah Admin
  const addAdminButton = document.getElementById("add-admin-button");
  const addAdminModal = document.getElementById("add-admin-modal");
  const cancelModalButton = document.getElementById("cancel-modal");
  const addAdminForm = document.getElementById("add-admin-form");

  if (addAdminButton && addAdminModal && cancelModalButton && addAdminForm) {
    addAdminButton.addEventListener("click", () => {
      addAdminModal.classList.remove("hidden");
    });

    cancelModalButton.addEventListener("click", () => {
      addAdminModal.classList.add("hidden");
    });

    addAdminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("new-username").value;
      const password = document.getElementById("new-password").value;

      try {
        const res = await fetch("/api/add-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // penting untuk kirim cookie JWT
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (res.ok) {
          PopupNotify.success(data.message || "Admin berhasil ditambahkan");
          addAdminModal.classList.add("hidden");
          addAdminForm.reset();
          fetchAdmins(); // Refresh tabel admin
        } else {
          PopupNotify.failed(data.message || "Gagal menambahkan admin.");
        }
      } catch (err) {
        PopupNotify.failed("Terjadi kesalahan pada server.");
      }
    });
  }

  // BARU: Logika untuk Select All Users
  const selectAllCheckbox = document.getElementById("select-all-users");
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll(".select-user").forEach((cb) => {
        cb.checked = isChecked;
      });
    });
  }

  // --- Panggil semua fungsi inisialisasi saat halaman dimuat ---
  fetchAdminGreeting();
  fetchAdmins();
  fetchUsers();
  fetchUploadedFiles();
}); // Akhir dari DOMContentLoaded

// Fungsi navigasi sidebar (bisa ditaruh di luar DOMContentLoaded)
function showSection(sectionId, element) {
  document
    .querySelectorAll("main > section")
    .forEach((sec) => sec.classList.add("hidden-section"));
  const selected = document.getElementById(sectionId);
  if (selected) selected.classList.remove("hidden-section");
  document
    .querySelectorAll(".nav-link")
    .forEach((link) => link.classList.remove("active"));
  if (element) element.classList.add("active");
}
