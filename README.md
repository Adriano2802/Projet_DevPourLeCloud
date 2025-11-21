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

curl.exe -X POST "http://localhost:3001/upload" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0" -F "image=@test.jpg"

curl.exe -X GET "http://localhost:3001/images" `
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMDc0OCwiZXhwIjoxNzYzNzE0MzQ4fQ.j9-3zzUskQTVMRgUmCrQ-gnTuEf13nkim4bcHWaZYGA"

curl.exe -X GET "http://localhost:3001/images/test.jpg" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0" -o downloaded.jpg

curl.exe -X GET "http://localhost:3001/images" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0"


curl.exe "http://localhost:3001/view/test.jpg" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0"

curl.exe -X POST http://localhost:3001/upload -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0" -F "image=@test.jpg"

http://localhost:3001/view/test.jpg?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidGVzdCIsImlhdCI6MTc2MzcxMTM4NCwiZXhwIjoxNzYzNzE0OTg0fQ.D3BpJ17YneHiYY1v0tPR_JjtrIJISHoC9I5pDgf28u0
