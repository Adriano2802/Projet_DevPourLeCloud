document.addEventListener("DOMContentLoaded", () => {
    const authArea = document.getElementById("auth-area");
    const guestDiv = document.getElementById("guest");
    const userDiv = document.getElementById("user");
    const userEmailSpan = document.getElementById("user-email");

    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");

    const dashboard = document.getElementById("dashboard");
    const fileInput = document.getElementById("file-input");
    const uploadBtn = document.getElementById("upload-btn");
    const uploadStatus = document.getElementById("upload-status");
    const imagesList = document.getElementById("images-list");

    const showRegisterBtn = document.getElementById("show-register");
    const showLoginBtn = document.getElementById("show-login");

    const API = "http://localhost:3001";

    // --- TOGGLE FORMS ---
    showRegisterBtn.addEventListener("click", () => {
        registerForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
    });

    showLoginBtn.addEventListener("click", () => {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
    });

    function showUser(email) {
        guestDiv.style.display = "none";
        userDiv.style.display = "block";
        userEmailSpan.textContent = email;
        dashboard.classList.remove("hidden");
    }

    function logout() {
        localStorage.removeItem("token");
        guestDiv.style.display = "block";
        userDiv.style.display = "none";
        dashboard.classList.add("hidden");
        imagesList.innerHTML = "";
    }

    // --- LOAD IMAGES ---
    async function loadImages() {
        imagesList.innerHTML = "";
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${API}/images`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const images = await res.json();

        for (const obj of images) {
            const key = obj.Key;
            const urlRes = await fetch(`${API}/image-url/${encodeURIComponent(key)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const { url } = await urlRes.json();

            // --- IMAGE CARD ---
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

    // --- REGISTER ---
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(registerForm);
        const res = await fetch(`${API}/register`, {
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

    // --- LOGIN ---
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const res = await fetch(`${API}/login`, {
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
            const payload = JSON.parse(atob(data.token.split(".")[1]));
            showUser(payload.user);
            loadImages();
        } else {
            alert("Login failed");
        }
    });

    // --- UPLOAD ---
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) return alert("Choisis un fichier !");
        const formData = new FormData();
        formData.append("image", file);

        uploadStatus.textContent = "Uploading...";
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        uploadStatus.textContent = data.message || data.error;
        loadImages();
    });

    document.getElementById("logout").addEventListener("click", logout);

    // --- INIT ---
    const token = localStorage.getItem("token");
    if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        showUser(payload.user);
        loadImages();
    }
});
