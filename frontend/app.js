document.addEventListener("DOMContentLoaded", () => {
    // --- DOM ELEMENTS ---
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

    // --- BACKEND NODE.JS ---
    const BACKEND = "http://localhost:3000";

    // --- TOGGLE FORMS ---
    showRegisterBtn.addEventListener("click", () => {
        registerForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
    });
    showLoginBtn.addEventListener("click", () => {
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
    });

    // --- SHOW USER PANEL ---
    function showUser(email) {
        guestDiv.style.display = "none";
        userDiv.style.display = "block";
        userEmailSpan.textContent = email;
        dashboard.classList.remove("hidden");
    }

    // --- LOGOUT ---
    function logout() {
        localStorage.removeItem("token");
        guestDiv.style.display = "block";
        userDiv.style.display = "none";
        dashboard.classList.add("hidden");
        imagesList.innerHTML = "";
    }

    // --- LOAD IMAGES FROM S3 VIA LAMBDAS ---
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

    // --- REGISTER ---
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

    // --- LOGIN ---
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
            const payload = JSON.parse(atob(data.token.split(".")[1]));
            showUser(payload.user);
            loadImages();
        } else {
            alert("Login failed");
        }
    });

    // --- UPLOAD FILE TO LAMBDA ---
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) return alert("Choisis un fichier !");

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(",")[1]; // on prend uniquement le contenu base64
            const token = localStorage.getItem("token");

            const res = await fetch(`${BACKEND}/upload`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    filename: file.name,
                    file: base64
                })
            });

            const data = await res.json();
            uploadStatus.textContent = data.message || data.error;
            loadImages();
        };
        reader.readAsDataURL(file);
    });

    // --- LOGOUT BUTTON ---
    document.getElementById("logout").addEventListener("click", logout);

    // --- INIT IF TOKEN EXISTS ---
    const token = localStorage.getItem("token");
    if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        showUser(payload.user);
        loadImages();
    }
});
