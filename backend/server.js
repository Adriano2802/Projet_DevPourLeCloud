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
const storage = multer.memoryStorage();
const upload = multer({ storage });
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

let thumbnailQueueUrl = process.env.THUMBNAIL_QUEUE_URL || null;

async function initQueueUrl() {
    if (thumbnailQueueUrl) return;
    try {
        const r = await sqs.send(new GetQueueUrlCommand({ QueueName: THUMBNAIL_QUEUE_NAME }));
        thumbnailQueueUrl = r.QueueUrl;
        console.log("SQS queue URL found:", thumbnailQueueUrl);
    } catch (err) {
        console.warn("⚠ Queue not yet created (no big deal in dev)");
    }
}
initQueueUrl();

// ---------------- AUTH MIDDLEWARE ----------------
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
app.post("/register", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) return res.status(400).json({ error: "Email and password required" });
        if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email format" });
        if (!isStrongPassword(password)) return res.status(400).json({ error: "Weak password (>=8 chars)" });

        const existingUser = await getUser(email);
        if (existingUser) return res.status(400).json({ error: "User already exists" });

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await createUser({ email, passwordHash, createdAt: new Date().toISOString() });

        console.log(`✔ User created: ${email}`);

        res.status(201).json({ message: "User created" });
    } catch (err) {
        next(err);
    }
});

// ---------------- LOGIN ----------------
app.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await getUser(email);
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ user: email }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ token });
    } catch (err) {
        next(err);
    }
});

// ---------------- SEED USERS (DEV ONLY) ----------------
app.post("/seed-users", async (req, res) => {
    const testUsers = [
        { email: "test1@example.com", password: "password123" },
        { email: "test2@example.com", password: "password123" }
    ];

    for (const u of testUsers) {
        const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
        await createUser({ email: u.email, passwordHash: hash, createdAt: new Date().toISOString() });
    }

    res.json({ message: "Users created", count: testUsers.length });
});

// ---------------- FILE UPLOAD + SQS ----------------
// (on laisse TA logique, juste petits logs)
app.post("/upload", auth, upload.single("image"), async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        const key = `${encodeURIComponent(req.user.user)}/${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));

        console.log(`📤 Uploaded to S3: ${key}`);

        if (!thumbnailQueueUrl) {
            try {
                const r = await sqs.send(new GetQueueUrlCommand({ QueueName: THUMBNAIL_QUEUE_NAME }));
                thumbnailQueueUrl = r.QueueUrl;
            } catch {
                console.warn("⚠ No queue found, skipping SQS message");
            }
        }

        if (thumbnailQueueUrl) {
            await sqs.send(new SendMessageCommand({
                QueueUrl: thumbnailQueueUrl,
                MessageBody: JSON.stringify({ bucket: BUCKET, key }),
            }));
            console.log(`📨 SQS message sent for ${key}`);
        }

        res.status(201).json({ message: "File uploaded", key });
    } catch (err) {
        next(err);
    }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
