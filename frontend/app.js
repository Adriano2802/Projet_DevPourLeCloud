document.addEventListener("DOMContentLoaded", () => {
    const BACKEND = "http://localhost:3000";

    // --- DETECT PAGE ---
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

    // --- DASHBOARD PAGE ---
    if (page === "dashboard") {
        const dashboard = document.getElementById("dashboard");
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

            const res = await fetch(`${BACKEND}/images`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const images = await res.json();

            for (const obj of images) {
                const key = obj.Key;
                const presigned = await fetch(`${BACKEND}/image-url/${encodeURIComponent(key)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const { url } = await presigned.json();

                const card = document.createElement("div");
                card.className = "img-card";

                const img = document.createElement("img");
                img.src = url;
                img.alt = key;

                const name = document.createElement("p");
                name.className = "img-name";
                name.textContent = key;

                card.appendChild(img);
                card.appendChild(name);
                imagesList.appendChild(card);
            }
        }

        uploadBtn.addEventListener("click", async () => {
            const file = fileInput.files[0];
            if (!file) return alert("Choisis un fichier !");

            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result.split(",")[1];
                const token = localStorage.getItem("token");

                const res = await fetch(`${BACKEND}/upload`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ filename: file.name, file: base64 })
                });

                const data = await res.json();
                uploadStatus.textContent = data.message || data.error;
                loadImages();
            };
            reader.readAsDataURL(file);
        });

        logoutBtn.addEventListener("click", logout);

        // --- INIT ---
        const token = localStorage.getItem("token");
        if (!token) {
            location.href = "login.html";
        } else {
            const payload = JSON.parse(atob(token.split(".")[1]));
            showUserPanel(payload.user);
            loadImages();
        }
    }

    // --- LOGIN PAGE ---
    if (page === "login") {
        redirectIfLoggedIn();
        const loginForm = document.getElementById("login-form");
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
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
            } else {
                alert("Login failed");
            }
        });
    }

    // --- REGISTER PAGE ---
    if (page === "register") {
        redirectIfLoggedIn();
        const registerForm = document.getElementById("register-form");
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const res = await fetch(`${BACKEND}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.get("email"),
                    password: formData.get("password")
                })
            });
            const data = await res.json();
            alert(data.message || data.error);
        });
    }
});
