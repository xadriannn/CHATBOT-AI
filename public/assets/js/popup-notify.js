/**
 * PopupNotify.js - Asset Notifikasi Pop-up Mandiri (Versi Gambar Kustom)
 */
const PopupNotify = {
  cssInjected: false,

  show(options) {
    if (!this.cssInjected) {
      this.injectCSS();
      this.cssInjected = true;
    }

    const defaults = {
      title: "",
      message: "",
      type: "info",
      okText: "OK",
      cancelText: "Batal",
      onOk: () => {},
      onCancel: () => {},
    };
    const settings = { ...defaults, ...options };

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const container = document.createElement("div");
    container.className = `popup-container popup-${settings.type}`;

    const closePopup = () => {
      container.classList.remove("popup-visible");
      overlay.classList.remove("popup-visible");
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 300);
    };

    container.innerHTML = `
      <div class="popup-header">
        <div class="popup-icon">${this.getIcon(settings.type)}</div>
        <h3 class="popup-title">${settings.title}</h3>
      </div>
      <p class="popup-message">${settings.message}</p>
      <div class="popup-footer"></div>
    `;

    const footer = container.querySelector(".popup-footer");
    if (settings.type === "confirm") {
      const cancelButton = document.createElement("button");
      cancelButton.className = "popup-button secondary";
      cancelButton.textContent = settings.cancelText;
      cancelButton.onclick = () => {
        settings.onCancel();
        closePopup();
      };

      const okButton = document.createElement("button");
      okButton.className = "popup-button primary";
      okButton.textContent = settings.okText;
      okButton.onclick = () => {
        settings.onOk();
        closePopup();
      };

      footer.append(cancelButton, okButton);
    } else {
      const okButton = document.createElement("button");
      okButton.className = "popup-button primary";
      okButton.textContent = settings.okText;
      okButton.onclick = closePopup;
      footer.appendChild(okButton);
    }

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.classList.add("popup-visible");
      container.classList.add("popup-visible");
    }, 10);

    if (settings.type !== "confirm") {
      setTimeout(closePopup, 4000);
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && settings.type === "confirm") {
        settings.onCancel();
        closePopup();
      }
    });
  },

  success(message, title = "Berhasil") {
    this.show({ title, message, type: "success" });
  },

  failed(message, title = "Gagal") {
    this.show({ title, message, type: "failed" });
  },

  info(message, title = "Informasi") {
    this.show({ title, message, type: "info" });
  },

  confirm(message, title = "Konfirmasi") {
    return new Promise((resolve) => {
      this.show({
        title,
        message,
        type: "confirm",
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  },

  // ✅ PERUBAHAN 1: Mengubah SVG menjadi tag <img>
  getIcon(type) {
    let imageName = "";
    // Asumsi ekstensi file adalah .png, sesuaikan jika berbeda (misal: .gif, .jpg)
    switch (type) {
      case "success":
        imageName = "caracter-success.png";
        break;
      case "failed":
        imageName = "caracter-fail.png";
        break;
      case "info":
        imageName = "caracter-info.png";
        break;
      case "confirm":
        imageName = "caracter-confirm.png";
        break;
    }
    if (imageName) {
      // Pastikan path 'assets/' sudah benar sesuai struktur folder Anda
      return `<img src="assets/${imageName}" alt="${type} icon">`;
    }
    return "";
  },

  // ✅ PERUBAHAN 2: Menyesuaikan CSS untuk gambar
  injectCSS() {
    const css = `
      :root {
        --popup-primary-btn: #0066cc;
        --popup-secondary-btn: #6c757d;
      }
      .popup-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0, 0, 0, 0.5); z-index: 1000;
        display: flex; justify-content: center; align-items: center;
        opacity: 0; transition: opacity 0.3s ease;
        font-family: font-family: 'Poppins', sans-serif;;
      }
      .popup-container {
        background-color: white; padding: 25px; border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); width: 90%;
        max-width: 500px; text-align: center; transform: scale(0.9);
        opacity: 0; transition: transform 0.3s ease, opacity 0.3s ease;
      }
      .popup-overlay.popup-visible { opacity: 1; }
      .popup-container.popup-visible { transform: scale(1); opacity: 1; }
      .popup-header { margin-bottom: 15px; }
      .popup-icon {
        width: 80px; /* Mungkin perlu disesuaikan ukurannya */
        height: 80px;
        margin: 0 auto 15px;
      }
      /* Mengubah target dari 'svg' menjadi 'img' */
      .popup-icon img {
        width: 100%;
        height: 100%;
        object-fit: contain; /* Agar gambar tidak gepeng */
      }
      /* Aturan warna untuk SVG sudah tidak diperlukan lagi */
      .popup-title {
        margin: 0; font-size: 1.5rem; font-weight: 600; color: #333;
      }
      .popup-message {
        margin: 0 0 25px; font-size: 1rem; color: #555; line-height: 1.5;
      }
      .popup-footer {
        display: flex; justify-content: center; gap: 15px;
      }
      .popup-button {
        border: none; padding: 12px 25px; border-radius: 8px;
        font-size: 1rem; font-weight: 600; cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .popup-button:hover {
        transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      }
      .popup-button.primary {
        background-color: var(--popup-primary-btn); color: white;
      }
      .popup-button.secondary {
        background-color: #e9ecef; color: #333;
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  },
};
