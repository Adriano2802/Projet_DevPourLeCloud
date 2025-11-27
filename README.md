# 🌩️ Image Manager --- Cloud-Native Web App

A complete cloud-ready image management application built using
**AWS-like services locally via LocalStack**, **OpenTofu**,
**API Gateway**, **Lambdas**, **S3**, **SQS**, and **DynamoDB**.\
This project demonstrates modern serverless architecture, event-driven
processing, and secure frontend integration.

------------------------------------------------------------------------

## 🚀 Features

-   **User Authentication**
    -   Register & login via API Gateway + Lambda
    -   User data stored in DynamoDB
-   **Image Upload**
    -   Uploads images securely to S3
    -   Upload Lambda generates SQS event
-   **Automatic Thumbnail Generation**
    -   Thumbnail Lambda processes SQS events
    -   Stores thumbnails in the same S3 bucket
-   **Image Listing**
    -   Fetch all user images
    -   Generate presigned S3 URLs for display
-   **Frontend Integration**
    -   Fully functional simple UI in vanilla JS

------------------------------------------------------------------------

## 📁 Project Structure

    Projet_DevPourLeCloud/
    ├── docker-compose.yml
    ├── infra/
    │   ├── main.tf
    │   ├── lambda-*.zip
    │   ├── lambda-*/index.js
    ├── backend/
    │   ├── db.js
    │   └── server.js
    └── frontend/
        ├── app.js
        ├── styles.css
        └── index.html

------------------------------------------------------------------------

## 🧩 Architecture Overview

The system uses an event-driven, serverless workflow:

1.  **Frontend** → sends requests to API Gateway
2.  API Gateway → triggers **Lambdas**
3.  Upload Lambda → writes image to **S3**, pushes message to **SQS**
4.  Thumbnail Lambda → listens to SQS, processes images, writes
    thumbnails to S3
5.  Image Lambda → lists user images from S3

------------------------------------------------------------------------

## 🛠️ Technologies

Component
-------------------- 
    Infrastructure   
    AWS Emulation 
    API                  
    Compute 
    Storage              
    Messaging            
    Monitoring           
    Frontend             
    Backend


Technology
--------------------
    OpenTofu
    LocalStack
    API Gateway
    Lambda
    S3 & DynamoDB
    SQS
    CloudWatch Logs
    HTML/CSS/JS
    Node.js


------------------------------------------------------------------------

## 🏗️ Setup & Installation

### 1. Start LocalStack

``` bash
docker-compose up -d
```

### 2. Deploy Infrastructure

``` bash
cd infra/
tofu init
tofu apply
```

### 3. Start Backend

``` bash
cd backend/
npm install
node server.js
```

### 4. Run Frontend

Open:

    frontend/index.html

------------------------------------------------------------------------

## 🔍 Testing the APIs

### Register:

``` bash
POST /register
{
  "email": "test@test.com",
  "password": "1234"
}
```

### Login:

``` bash
POST /login
```

→ Returns JWT token

### Upload:

``` bash
POST /upload
Authorization: Bearer <token>
```

### List Images:

``` bash
GET /images
Authorization: Bearer <token>
```

------------------------------------------------------------------------

## 📦 AWS Resources (Simulated via LocalStack)

-   **S3** -- Stores images & thumbnails
-   **DynamoDB** -- Stores users
-   **SQS** -- Triggers thumbnail processing
-   **Lambda** -- Business logic
-   **API Gateway** -- REST API
-   **IAM** -- Permissions model
-   **CloudWatch Logs** -- Monitoring/debugging

------------------------------------------------------------------------

## 🖼️ Thumbnail Workflow

1.  User uploads image
2.  Image saved to S3
3.  Lambda publishes event to SQS
4.  Thumbnail Lambda reads SQS event
5.  Thumbnail created & saved to S3

------------------------------------------------------------------------

## 🤝 Contributing

    AKCHA Aymane
    MESSAOUDI Walid
    PONYORI Adriano