# Projet_DevPourLeCloud

docker compose up -d
docker compose logs -f localstack
docker compose down
docker compose rm -f
docker compose up -d
docker compose logs -f localstack

tofu init
tofu apply -auto-approve

aws --endpoint-url=http://localhost:4566 s3 ls 

lancer server node :
node server.js

token temporaire :
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0

$token = $response.token
$imagePath = "C:\Users\adria\OneDrive\Bureau\M2 - Miage\Développement dans le cloud\Projet\Projet_DevPourLeCloud\backend\test.jpg"

Invoke-RestMethod -Method Post -Uri http://localhost:3001/upload `
    -Headers @{ Authorization = "Bearer $token" } `
-InFile $imagePath `
-ContentType "multipart/form-data"