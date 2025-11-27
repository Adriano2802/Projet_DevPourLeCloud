// backend/server.js
import express from "express";
import { DeleteObjectCommand } from "@aws-sdk/client-s3"; // ⚠️ ajoute en haut avec les autres imports
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    GetObjectCommand
} from "@aws-sdk/client-s3";
import {
    SQSClient,
    SendMessageCommand,
    GetQueueUrlCommand
} from "@aws-sdk/client-sqs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getUser, createUser } from "./db.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ---------------- CONFIG ----------------
const app = express();
const PORT = process.env.PORT || 3000;
const BUCKET = process.env.USER_IMAGES_BUCKET || "userimages";
const JWT_SECRET = process.env.JWT_SECRET || "MY_SECRET";
const THUMBNAIL_QUEUE_NAME = process.env.THUMBNAIL_QUEUE_NAME || "thumbnail-queue";
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";
const SALT_ROUNDS = 10;

// Middleware JSON
app.use(express.json({ limit: "10mb" })); // support base64 uploads
app.use(cors());

// servir les fichiers statiques du front
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.resolve(__dirname, "../frontend")));

// ---------------- S3 & SQS ----------------
const s3 = new S3Client({ region: "us-east-1", endpoint: LOCALSTACK_ENDPOINT, forcePathStyle: true });
const sqs = new SQSClient({ region: "us-east-1", endpoint: LOCALSTACK_ENDPOINT });

let thumbnailQueueUrl = process.env.THUMBNAIL_QUEUE_URL || null;
async function initQueueUrl() {
    if (thumbnailQueueUrl) return;
    try {
        const r = await sqs.send(new GetQueueUrlCommand({ QueueName: THUMBNAIL_QUEUE_NAME }));
        thumbnailQueueUrl = r.QueueUrl;
    } catch {
        console.warn("⚠ Queue not yet created (dev only)");
    }
}
initQueueUrl();

// ---------------- AUTH ----------------
function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });

    try {
        const token = header.split(" ")[1];
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}

// ---------------- VALIDATION ----------------
function isValidEmail(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isStrongPassword(pwd) {
    return typeof pwd === "string" && pwd.length >= 8;
}

// ---------------- REGISTER ----------------
app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email format" });
    if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password (>=8 chars)" });

    const existingUser = await getUser(email);
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await createUser({ email, passwordHash, createdAt: new Date().toISOString() });

    res.status(201).json({ message: "User created" });
});

// ---------------- LOGIN ----------------
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await getUser(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ user: email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

// ---------------- UPLOAD BASE64 ----------------
app.post("/upload", auth, async (req, res) => {
    try {
        const { filename, file } = req.body;
        if (!filename || !file) return res.status(400).json({ error: "filename + file (base64) required" });

        const buffer = Buffer.from(file, "base64");
        const key = `${encodeURIComponent(req.user.user)}/${Date.now()}_${filename.replace(/\s+/g, "_")}`;

        await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer }));

        if (!thumbnailQueueUrl) {
            try {
                const r = await sqs.send(new GetQueueUrlCommand({ QueueName: THUMBNAIL_QUEUE_NAME }));
                thumbnailQueueUrl = r.QueueUrl;
            } catch { console.warn("⚠ No queue found"); }
        }

        if (thumbnailQueueUrl) {
            await sqs.send(new SendMessageCommand({ QueueUrl: thumbnailQueueUrl, MessageBody: JSON.stringify({ bucket: BUCKET, key }) }));
        }

        res.status(201).json({ message: "File uploaded", key });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------- LIST USER IMAGES ----------------
app.get("/images", auth, async (req, res) => {
    const prefix = encodeURIComponent(req.user.user) + "/";
    const objects = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    res.json(objects.Contents || []);
});

// ---------------- SIGNED URL ----------------
app.get("/image-url/:key", auth, async (req, res) => {
    const key = req.params.key;
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url });
});
// ---------------- DELETE IMAGE ----------------


app.delete("/delete", auth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "URL requise" });

        // extraire la clé depuis l’URL presignée
        const u = new URL(url);
        const key = decodeURIComponent(u.pathname.split("/").slice(2).join("/"));
        // slice(2) car l’URL est du type /userimages/<clé>

        console.log("Suppression demandée pour la clé:", key);

        await s3.send(new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key
        }));

        res.json({ success: true, message: "Image supprimée" });
    } catch (err) {
        console.error("Erreur suppression S3:", err);
        res.status(500).json({ error: "Erreur lors de la suppression" });
    }
});


// ---------------- START ----------------
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
