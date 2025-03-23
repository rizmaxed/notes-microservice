# Notes Microservice · Serverless Application with AWS SAM, CodePipeline & Powertools

This project demonstrates how to build, deploy, and monitor a **Production-grade Serverless Notes API** using AWS Serverless Application Model (SAM), GitHub-integrated CI/CD pipeline, and AWS observability tooling.

Each function in this microservice is responsible for a specific CRUD operation and is instrumented with **AWS Lambda Powertools** for logging, metrics, and X-Ray tracing. A complete DevOps workflow is configured using **AWS CodePipeline** and **CodeBuild** to enable automated deployments on each GitHub push.

![Architecture](media/nfc-arch-lab-10-10.svg)

---

## Features

- 🧩 Modular microservice design (1 Lambda = 1 route)
- ⚙️ GitHub → CodePipeline → CodeBuild → SAM deployment
- 🔍 AWS Lambda Powertools for:
  - Structured JSON logs
  - Custom CloudWatch metrics
  - AWS X-Ray tracing with annotations and metadata
- 🔐 Fine-grained IAM roles for Lambda + CodeBuild + CodePipeline
- 🔁 DynamoDB for persistence with TTL and GSI support
- 🌐 CORS-enabled API Gateway with custom headers for multi-user support

---

## Lab Scenario (for learners)

You're building a serverless Notes API using AWS services. The goal is to:

- Build, deploy, and test the app end-to-end
- Automate CI/CD from GitHub to AWS using SAM, CodePipeline, and CodeBuild
- Use Powertools for observability (structured logs, metrics, X-Ray traces)
- Analyze logs with CloudWatch Logs Insights
- Trace errors and performance bottlenecks using AWS X-Ray

---

## API Endpoints

| Method | Path                | Description                                   |
| ------ | ------------------- | --------------------------------------------- |
| POST   | `/note`             | Create a new note                             |
| PATCH  | `/note`             | Update an existing note                       |
| DELETE | `/note/t/{ts}`      | Delete a note by timestamp                    |
| GET    | `/note/n/{note_id}` | Fetch a note by ID (GSI)                      |
| GET    | `/notes`            | List all notes for user (supports pagination) |

---

## Tech Stack

- **Node.js 22.x (ESM)**
- **AWS Lambda**
- **Amazon API Gateway**
- **Amazon DynamoDB**
- **AWS SAM (Serverless Application Model)**
- **AWS CodePipeline + CodeBuild**
- **AWS Lambda Powertools for Node.js**
- **Postman (for testing)**
