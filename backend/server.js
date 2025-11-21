import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getUser, createUser } from "./db.js";


// ---------------- CONFIG ----------------

const app = express();
const PORT = 3001;
const BUCKET = "userimages";

// Middleware JSON
app.use(express.json());

// ---------------- AUTH ----------------

// Fake middleware d'auth (dev)
function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });

    const token = header.split(" ")[1];
    try {
        jwt.verify(token, "MY_SECRET");
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

// ---------------- MULTER ----------------

const upload = multer({
    storage: multer.memoryStorage(),
});

// ---------------- S3 CONFIG (LocalStack) ----------------

const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:4566",
    forcePathStyle: true,
});

// ---------------- ROUTES ----------------

// ✔ Upload fichier vers S3
app.post("/upload", auth, upload.single("image"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: file.originalname,
            Body: file.buffer,
            ContentType: file.mimetype, // Important pour affichage web
        })
    );

    res.json({ message: "File uploaded", name: file.originalname });
});

// ✔ Liste fichiers
app.get("/images", auth, async (req, res) => {
    const data = await s3.send(
        new ListObjectsV2Command({
            Bucket: BUCKET,
        })
    );

    res.json(data.Contents || []);
});

// ✔ Signed URL publique temporaire
app.get("/image-url/:name", auth, async (req, res) => {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: req.params.name,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        res.json({ url });
    } catch (e) {
        res.status(404).json({ error: "File not found" });
    }
});

// ✔ Vue directe (image inline dans navigateur)
app.get("/view/:name", async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
        jwt.verify(token, "MY_SECRET");
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }

    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: req.params.name,
    });

    const data = await s3.send(command);

    res.setHeader("Content-Disposition", "inline"); // ← Affiche au lieu de télécharger
    res.setHeader("Content-Type", data.ContentType || "image/jpeg");

    data.Body.pipe(res);
});

app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const existingUser = await getUser(email);
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    await createUser({ email, password });
    res.json({ message: "User created" });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await getUser(email);
    if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Génère un token JWT
    const token = jwt.sign({ user: email }, "MY_SECRET", { expiresIn: "1h" });
    res.json({ token });
});



// ---------------- START SERVER ----------------

app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
);
