# CuteChat DevOps Ready

CuteChat has been successfully restructured from a monolith into a robust microservices architecture ready for deployment via Jenkins, Docker, AWS ECR, and AWS EKS.

## Architecture

The system is split into the following microservices:

1. **auth-service** (Port 5001) - Handles User Registration, Authentication, and JWT issuing. Connects to `authdb` in MongoDB.
2. **chat-service** (Port 5002) - A Stateless Socket.io server to handle real-time events. It handles broadcasting to rooms and validates JWT tokens on connection.
3. **message-service** (Port 5003) - An internal REST API for storing and retrieving messages for chat rooms. Connects to `messagedb` in MongoDB.
4. **frontend** (Port 3000) - A sleek React application connecting users to the services.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Running Locally

```bash
# 1. Prepare environment variables
cp .env.example .env
# Open .env and add your MONGO_URI and AWS credentials

# 2. Build and run
docker compose up --build
```

Access the frontend via:
`http://localhost:3000`

### Network Flow

- **Frontend -> Auth Service:** Calls `POST /api/auth/signup` & `login` to fetch JWT token.
- **Frontend -> Chat Service:** Connects via Socket.io passing JWT `token` in auth payload.
- **Chat Service -> Message Service:** Upon receiving a message, Chat Service broadcasts via Socket.io to clients, then fires an async HTTP `POST` to message-service to persist the log.
- **Chat Service -> Message Service:** When a user joins via `join` event, Chat service calls HTTP `GET` to message-service to resolve chat history and passes it directly back to the Socket client.

## DevOps Journey Next Steps

To deploy this setup using AWS & Jenkins:

1. **Jenkins Pipeline (`Jenkinsfile`):** Create a CI/CD pipeline that triggers on push. It will build Docker images for `auth-service`, `chat-service`, `message-service`, and `frontend`.
2. **AWS ECR:** The pipeline runs `docker build` and `docker push` sending all 4 images to respective internal private ECR Repositories.
3. **AWS EKS:** Develop Helm charts (or plain k8s YAMLs) for each Deployment and Service. The Jenkins pipeline uses `kubectl set image` to trigger rolling updates on the AWS Kubernetes EKS cluster upon successful build.

The architecture is explicitly stateless in the web tiers holding fast auto-scale capability. All persistent data lives in the decoupled Mongo storage tier.
