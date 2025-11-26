document.addEventListener("DOMContentLoaded", () => {
    const BACKEND = "http://localhost:3000";
    const page = document.body.dataset.page;

    // --- COMMON FUNCTIONS ---
    function redirectIfLoggedIn() {
        const token = localStorage.getItem("token");
        if (token) {
            location.href = "dashboard.html";
        }
    }

    function showUserPanel(email) {
        const userEmailSpan = document.getElementById("user-email");
        if (userEmailSpan) userEmailSpan.textContent = email;
    }

    function showAlert(container, message, type = "danger") {
        container.innerHTML = `
          <div class="alert alert-${type} mt-3" role="alert">
            ${message}
          </div>
        `;
    }

    // --- DASHBOARD PAGE ---
    if (page === "dashboard") {
        const imagesList = document.getElementById("images-list");
        const fileInput = document.getElementById("file-input");
        const uploadBtn = document.getElementById("upload-btn");
        const uploadStatus = document.getElementById("upload-status");
        const logoutBtn = document.getElementById("logout");

        function logout() {
            localStorage.removeItem("token");
            location.href = "login.html";
        }

        async function loadImages() {
            imagesList.innerHTML = "";
            const token = localStorage.getItem("token");
            if (!token) return;

            try {
                const res = await fetch(`${BACKEND}/images`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const images = await res.json();

                for (const obj of images) {
                    const key = obj.Key;

                    // Récupère le thumbnail si existant
                    const presigned = await fetch(`${BACKEND}/image-url/${encodeURIComponent(key)}?thumb=true`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const { url } = await presigned.json();

                    const col = document.createElement("div");
                    col.className = "col-md-4";

                    const card = document.createElement("div");
                    card.className = "card shadow";

                    const img = document.createElement("img");
                    img.src = url; // thumbnail si disponible
                    img.alt = key;
                    img.className = "card-img-top";

                    const body = document.createElement("div");
                    body.className = "card-body text-center";

                    // Bouton download orange
                    const downloadBtn = document.createElement("a");
                    downloadBtn.href = url;
                    downloadBtn.download = key;
                    downloadBtn.className = "btn btn-primary-color btn-sm mt-2";
                    downloadBtn.textContent = "Télécharger";

                    // Bouton supprimer orange
                    const deleteBtn = document.createElement("button");
                    deleteBtn.className = "btn btn-primary-color btn-sm mt-2 ms-2";
                    deleteBtn.textContent = "Supprimer";

                    deleteBtn.addEventListener("click", async () => {
                        try {
                            const res = await fetch(`${BACKEND}/delete/${encodeURIComponent(key)}`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const data = await res.json();
                            if (data.message) loadImages();
                            else alert("Erreur lors de la suppression");
                        } catch {
                            alert("Erreur serveur");
                        }
                    });

                    body.appendChild(downloadBtn);
                    body.appendChild(deleteBtn);
                    card.appendChild(img);
                    card.appendChild(body);
                    col.appendChild(card);
                    imagesList.appendChild(col);
                }
            } catch {
                showAlert(uploadStatus, "Erreur lors du chargement des images", "danger");
            }
        }

        uploadBtn.addEventListener("click", async () => {
            const file = fileInput.files[0];
            if (!file) return alert("Choisis un fichier !");

            uploadStatus.innerHTML = `<div class="alert alert-info mt-3">Téléversement en cours...</div>`;

            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result.split(",")[1];
                const token = localStorage.getItem("token");

                try {
                    const res = await fetch(`${BACKEND}/upload`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ filename: file.name, file: base64 })
                    });
                    const data = await res.json();
                    if (!data.error) {
                        showAlert(uploadStatus, "Image chargée avec succès ! Traitement du thumbnail en cours...", "success");
                        // On attend 1-2s pour que le thumbnail soit généré par SQS/Lambda
                        setTimeout(loadImages, 2000);
                    } else {
                        showAlert(uploadStatus, data.error, "danger");
                    }
                } catch {
                    showAlert(uploadStatus, "Erreur lors du téléversement", "danger");
                }
            };
            reader.readAsDataURL(file);
        });

        logoutBtn.addEventListener("click", logout);

        const token = localStorage.getItem("token");
        if (!token) location.href = "login.html";
        else {
            const payload = JSON.parse(atob(token.split(".")[1]));
            showUserPanel(payload.user);
            loadImages();
        }
    }

    // --- LOGIN PAGE ---
    if (page === "login") {
        redirectIfLoggedIn();
        const loginForm = document.getElementById("login-form");
        const container = loginForm.parentElement;

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            try {
                const res = await fetch(`${BACKEND}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: formData.get("email"),
                        password: formData.get("password")
                    })
                });
                const data = await res.json();
                if (data.token) {
                    localStorage.setItem("token", data.token);
                    location.href = "dashboard.html";
                } else if (data.error) {
                    showAlert(container, data.error || "Échec de la connexion", "danger");
                }
            } catch {
                showAlert(container, "Erreur serveur", "danger");
            }
        });
    }

    // --- REGISTER PAGE ---
    if (page === "register") {
        redirectIfLoggedIn();
        const registerForm = document.getElementById("register-form");
        const container = registerForm.parentElement;

        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            try {
                const res = await fetch(`${BACKEND}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: formData.get("email"),
                        password: formData.get("password")
                    })
                });
                const data = await res.json();
                if (data.error) showAlert(container, data.error, "danger");
                else {
                    container.innerHTML = `
                        <div class="alert alert-success mt-3" role="alert">
                            Utilisateur créé avec succès. Connectez‑vous pour continuer.
                            <div class="mt-2">
                                <a href="login.html" class="btn btn-primary btn-sm">Se connecter</a>
                            </div>
                        </div>
                    `;
                }
            } catch {
                showAlert(container, "Erreur serveur", "danger");
            }
        });
    }
});
