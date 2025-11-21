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

