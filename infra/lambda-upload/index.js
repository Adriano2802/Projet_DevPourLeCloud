const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const s3 = new S3Client({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566",
    forcePathStyle: true
});

const sqs = new SQSClient({
    region: "us-east-1",
    endpoint: "http://host.docker.internal:4566"
});

exports.handler = async (event) => {
    try {
        // Assure-toi que event.body est bien une string JSON
        const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;

        const { filename, content } = body; // 'content' correspond à ton payload base64

        if (!filename || !content) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "filename + content (base64) required" })
            };
        }

        const key = `uploads/${Date.now()}-${filename}`;
        const buffer = Buffer.from(content, "base64");

        // Upload vers S3
        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.BUCKET,
                Key: key,
                Body: buffer
            })
        );

        // Envoi du message à SQS
        await sqs.send(
            new SendMessageCommand({
                QueueUrl: process.env.QUEUE_URL,
                MessageBody: JSON.stringify({ key })
            })
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Uploaded!", key })
        };
    } catch (err) {
        console.error("UPLOAD ERROR:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
