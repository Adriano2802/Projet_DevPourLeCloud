// backend/server.js
import express from "express";
import multer from "multer";
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

// ---------------- CONFIG ----------------
const app = express();
const PORT = process.env.PORT || 3001;
const BUCKET = process.env.USER_IMAGES_BUCKET || "userimages";
const JWT_SECRET = process.env.JWT_SECRET || "MY_SECRET";
const THUMBNAIL_QUEUE_NAME = process.env.THUMBNAIL_QUEUE_NAME || "thumbnail-queue";
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";

const SALT_ROUNDS = 10;

// Middleware JSON
app.use(express.json());

// ---------------- S3 & SQS (LocalStack) ----------------
const s3 = new S3Client({
    region: "us-east-1",
    endpoint: LOCALSTACK_ENDPOINT,
    forcePathStyle: true,
});

const sqs = new SQSClient({
    region: "us-east-1",
    endpoint: LOCALSTACK_ENDPOINT,
});

// Cache de la Queue URL (récupérée au démarrage si possible)
let thumbnailQueueUrl = process.env.THUMBNAIL_QUEUE_URL || null;

async function initQueueUrl() {
    if (thumbnailQueueUrl) return;
    try {
        const r = await sqs.send(new GetQueueUrlCommand({ QueueName: THUMBNAIL_QUEUE_NAME }));
        thumbnailQueueUrl = r.QueueUrl;
        console.log("SQS queue URL found:", thumbnailQueueUrl);
    } catch (err) {
        console.warn("SQS queue not found at startup (ok en dev si non créée). Will try again on send.", err.message);
        thumbnailQueueUrl = null;
    }
}
initQueueUrl();

// ---------------- AUTH ----------------

// Middleware d'auth : vérifie JWT et ajoute req.user = { user }
function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });

    const token = header.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // ex: { user: "email@example.com", iat, exp }
        next();
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

// ---------------- MULTER (validation simple) ----------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Type de fichier non autorisé"), false);
        }
        cb(null, true);
    },
});

// ---------------- ROUTES ----------------

// Upload -> S3 + envoi d'un message SQS (si queue dispo)
app.post("/upload", auth, upload.single("image"), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        // Préfixe user pour isolation
        const key = `${encodeURIComponent(req.user.user)}/${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            })
        );

        // assure queue url
        if (!thumbnailQueueUrl) {
            try {
                const r = await sqs.send(new GetQueueUrlCommand({ QueueName: THUMBNAIL_QUEUE_NAME }));
                thumbnailQueueUrl = r.QueueUrl;
                console.log("Resolved queue url at upload:", thumbnailQueueUrl);
            } catch (err) {
                console.warn("Cannot resolve queue URL; SQS message not sent:", err.message);
            }
        }

        if (thumbnailQueueUrl) {
            const payload = { bucket: BUCKET, key, user: req.user.user, uploadedAt: new Date().toISOString() };
            await sqs.send(new SendMessageCommand({
                QueueUrl: thumbnailQueueUrl,
                MessageBody: JSON.stringify(payload),
            }));
        }

        res.status(201).json({ message: "File uploaded", name: key, processing: !!thumbnailQueueUrl });
    } catch (err) {
        next(err);
    }
});

// Liste fichiers (retourne la liste brute)
app.get("/images", auth, async (req, res, next) => {
    try {
        const data = await s3.send(
            new ListObjectsV2Command({
                Bucket: BUCKET,
                Prefix: `${encodeURIComponent(req.user.user)}/`,
            })
        );

        res.json(data.Contents || []);
    } catch (err) {
        next(err);
    }
});

// Signed URL publique temporaire
app.get("/image-url/:name", auth, async (req, res, next) => {
    try {
        const key = req.params.name;
        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        res.json({ url });
    } catch (e) {
        next(e);
    }
});

// View direct (inline) — protège via token query (pour les emails dans embed)
app.get("/view/:name", async (req, res, next) => {
    const token = req.query.token;
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
        jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
    }

    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: req.params.name,
        });

        const data = await s3.send(command);

        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Content-Type", data.ContentType || "image/jpeg");

        // data.Body est un stream Readable dans AWS SDK v3
        data.Body.pipe(res);
    } catch (err) {
        next(err);
    }
});

// ---------------- AUTH: register / login ----------------

// Validation email simple
function isValidEmail(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Register
app.post("/register", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });
        if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email" });
        if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Password must be >= 8 chars" });

        const existingUser = await getUser(email);
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // stocke email + passwordHash (db.js gère l'insertion)
        await createUser({ email, passwordHash, createdAt: new Date().toISOString() });

        res.status(201).json({ message: "User created" });
    } catch (err) {
        next(err);
    }
});

// Login
app.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await getUser(email);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const hash = user.passwordHash || user.password; // fallback si user ancien
        const ok = await bcrypt.compare(password, hash);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        // Génère un token JWT léger
        const token = jwt.sign({ user: email }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    } catch (err) {
        next(err);
    }
});

// ---------------- Error handler ----------------
app.use((err, req, res, next) => {
    console.error(err);
    if (err.message && err.message.includes("Type de fichier non autorisé")) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal server error", details: err.message });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
