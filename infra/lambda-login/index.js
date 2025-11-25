const {
    DynamoDBClient,
    GetItemCommand
} = require("@aws-sdk/client-dynamodb");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dynamodb = new DynamoDBClient({
    endpoint: process.env.DYNAMO_ENDPOINT,
    region: "us-east-1"
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

exports.handler = async (event) => {

    const body = JSON.parse(event.body || "{}");
    const { email, password } = body;

    if (!email || !password) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Email et mot de passe requis." })
        };
    }

    try {
        const result = await dynamodb.send(
            new GetItemCommand({
                TableName: "users",
                Key: {
                    email: { S: email }
                }
            })
        );

        if (!result.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "Utilisateur introuvable." })
            };
        }

        const user = {
            email: result.Item.email.S,
            password: result.Item.password.S
        };

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: "Mot de passe incorrect." })
            };
        }

        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

        return {
            statusCode: 200,
            body: JSON.stringify({ token })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Erreur serveur", details: err.message })
        };
    }
};
