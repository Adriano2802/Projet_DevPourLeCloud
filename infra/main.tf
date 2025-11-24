terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 5.40.0"
    }
  }
}

provider "aws" {
  region  = "us-east-1"

  access_key = "test"
  secret_key = "test"

  s3_use_path_style = true

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  skip_region_validation      = true

  endpoints {
    sts        = "http://localhost:4566"
    iam        = "http://localhost:4566"
    s3         = "http://localhost:4566"
    dynamodb   = "http://localhost:4566"
    lambda     = "http://localhost:4566"
    sqs        = "http://localhost:4566"
    apigateway = "http://localhost:4566"
  }
}


resource "aws_s3_bucket" "images" {
  bucket = "userimages"
  force_destroy = true
}


resource "aws_dynamodb_table" "users" {
  name         = "users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }
}

resource "aws_sqs_queue" "thumbnail_queue" {
  name                       = "thumbnail-queue"
  fifo_queue                 = false
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400

  # Désactive la vérification SSE qui fait bugger LocalStack
  sqs_managed_sse_enabled = false

  tags = {
    env = "local"
  }
}

output "thumbnail_queue_url" {
  value = aws_sqs_queue.thumbnail_queue.id
}
output "thumbnail_queue_arn" {
  value = aws_sqs_queue.thumbnail_queue.arn
}

# --------------------------------------
# Lambda : Thumbnail Generator
# --------------------------------------
resource "aws_lambda_function" "thumbnail_function" {
  function_name = "thumbnail-function"
  role          = "arn:aws:iam::000000000000:role/lambda-role" # Fake IAM ARN pour LocalStack

  handler = "lambda.handler"
  runtime = "nodejs18.x"

  filename         = "${path.module}/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")

  environment {
    variables = {
      BUCKET = aws_s3_bucket.images.bucket
    }
  }
}

# --------------------------------------
# API Gateway REST API
# --------------------------------------
resource "aws_api_gateway_rest_api" "thumbnail_api" {
  name = "thumbnail-api"
}

# La ressource /thumbnail
resource "aws_api_gateway_resource" "thumbnail" {
  rest_api_id = aws_api_gateway_rest_api.thumbnail_api.id
  parent_id   = aws_api_gateway_rest_api.thumbnail_api.root_resource_id
  path_part   = "thumbnail"
}

# Méthode GET sur /thumbnail
resource "aws_api_gateway_method" "get_thumbnail" {
  rest_api_id   = aws_api_gateway_rest_api.thumbnail_api.id
  resource_id   = aws_api_gateway_resource.thumbnail.id
  http_method   = "GET"
  authorization = "NONE"
}

# Intégration GET → Lambda
resource "aws_api_gateway_integration" "thumbnail_integration" {
  rest_api_id             = aws_api_gateway_rest_api.thumbnail_api.id
  resource_id             = aws_api_gateway_resource.thumbnail.id
  http_method             = aws_api_gateway_method.get_thumbnail.http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.thumbnail_function.invoke_arn
}

# Déploiement
resource "aws_api_gateway_deployment" "thumbnail_deployment" {
  depends_on = [aws_api_gateway_integration.thumbnail_integration]
  rest_api_id = aws_api_gateway_rest_api.thumbnail_api.id
  stage_name  = "dev"
}

# Permission API Gateway → Lambda
resource "aws_lambda_permission" "apigw_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail_function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.thumbnail_api.execution_arn}/*/*"
}

# Output URL
output "api_url" {
  value = "${aws_api_gateway_deployment.thumbnail_deployment.invoke_url}/thumbnail"
}

