terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                  = "us-east-1"
  access_key              = "test"
  secret_key              = "test"

  s3_use_path_style       = true

  endpoints {
    s3             = "http://localhost:4566"
    sts            = "http://localhost:4566"
    iam            = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    lambda         = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    apigateway     = "http://localhost:4566"
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


