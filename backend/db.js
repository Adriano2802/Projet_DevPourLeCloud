// backend/db.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

// ---------------- CONFIG ----------------
const ddbClient = new DynamoDBClient({
    region: "us-east-1",
    endpoint: "http://localhost:4566", // LocalStack
    credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
    },
});

export const docClient = DynamoDBDocumentClient.from(ddbClient);

// ---------------- FONCTIONS UTILISATEURS ----------------
export async function getUser(email) {
    const params = {
        TableName: "users",
        Key: { email },
    };

    const result = await docClient.send(new GetCommand(params));
    return result.Item;
}

export async function createUser(user) {
    const params = {
        TableName: "users",
        Item: user,
    };

    await docClient.send(new PutCommand(params));
    return user;
}
