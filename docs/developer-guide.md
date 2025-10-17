# Developer Guide: Pixie AI Real-time Communication Platform

This comprehensive guide provides complete instructions for setting up and running the Pixie AI platform for local development, including all Phase 2 implementation requirements, and deployment instructions.

## Table of Contents

1.  [Prerequisites and System Requirements](#1-prerequisites-and-system-requirements)
2.  [Technology Stack Installation](#2-technology-stack-installation)
3.  [Database Setup with PostgreSQL and Prisma](#3-database-setup-with-postgresql-and-prisma)
4.  [LiveKit Server Configuration](#4-livekit-server-configuration)
5.  [Environment Variables and Configuration](#5-environment-variables-and-configuration)
6.  [Backend Setup (Feathers.js)](#6-backend-setup-feathersjs)
7.  [Frontend Setup (Next.js)](#7-frontend-setup-nextjs)
8.  [Testing Framework Setup](#8-testing-framework-setup)
9.  [Development Server Startup](#9-development-server-startup)
10. [Verification Steps](#10-verification-steps)
11. [Troubleshooting Guide](#11-troubleshooting-guide)
12. [Deployment](#12-deployment)

---

## 1. Prerequisites and System Requirements

### Minimum System Requirements

- **Operating System**: Linux (Ubuntu 20.04+), macOS (12.0+), or Windows 10/11 with WSL2
- **Memory**: 8GB RAM minimum, 16GB recommended
- **Storage**: 10GB free space for dependencies and database
- **Network**: Broadband internet connection for LiveKit server setup

### Required Software

- **Node.js**: v18.17.0 (LTS) or later
- **npm**: v8.0.0 or later (comes with Node.js)
- **Docker**: v20.10.0 or later
- **Docker Compose**: v2.0.0 or later
- **Git**: v2.30.0 or later
- **OpenSSL**: v1.1.1 or later (for generating secure keys)

### Optional but Recommended

- **Redis**: v7.0+ (for session storage and caching)
- **Visual Studio Code**: Latest version with TypeScript support
- **Postman** or **Insomnia**: For API testing

## 2. Technology Stack Installation

### Node.js Installation

**Ubuntu/Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS (using Homebrew):**

```bash
brew install node@18
```

**Windows (using Chocolatey):**

```powershell
choco install nodejs --version=18.17.0
```

**Verify installation:**

```bash
node --version  # Should output v18.17.0 or later
npm --version   # Should output v8.0.0 or later
```

### Docker Installation

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

**macOS:**

```bash
brew install --cask docker
# Start Docker Desktop application
```

**Windows:**

```powershell
choco install docker-desktop
# Or download from https://www.docker.com/products/docker-desktop
```

**Verify installation:**

```bash
docker --version
docker-compose --version
```

### Redis Installation (Optional)

**Ubuntu/Debian:**

```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS:**

```bash
brew install redis
brew services start redis
```

**Verify installation:**

```bash
redis-cli ping  # Should return PONG
```

## 3. Database Setup with PostgreSQL and Prisma

### PostgreSQL Setup

1. **Start PostgreSQL container:**

```bash
docker run --name pixie-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=pixie_ai_dev \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  -d postgres:15.0
```

2. **Verify PostgreSQL is running:**

```bash
docker ps | grep pixie-postgres
# Should show the running container
```

3. **Test database connection:**

```bash
docker exec pixie-postgres psql -U postgres -d pixie_ai_dev -c "SELECT version();"
```

### Prisma Setup

Prisma v6.17.1 is included in the project dependencies and will be installed when you run `npm install` in the backend directory.

**Database Schema Overview:**

- **Users**: Authentication and profile management
- **Sessions**: Live streaming session data and metadata
- **Participants**: Session participant tracking
- **Password Reset**: Secure token-based password recovery

## 4. LiveKit Server Configuration

### LiveKit Server Setup

1. **Download and install LiveKit CLI:**

```bash
# Download the latest release
curl -LO https://github.com/livekit/livekit/releases/latest/download/livekit_linux_amd64
chmod +x livekit_linux_amd64
sudo mv livekit_linux_amd64 /usr/local/bin/livekit
```

2. **Generate LiveKit configuration:**

```bash
mkdir -p ~/livekit/config
cd ~/
livekit

# Generate server configuration
cat > config/livekit-server.yaml << EOF
port: 7880
bind: 0.0.0.0
rtc:
  port_range_start: 7881
  port_range_end: 7900
  udp_port: 7882
redis:
  address: localhost:6379
  db: 0
keys:
  devkey: "your-livekit-api-key-here"
logging:
  level: debug
EOF
```

3. **Start LiveKit server:**

```bash
livekit --config config/livekit-server.yaml
```

4. **Verify LiveKit server:**

```bash
curl http://localhost:7880/api/health
# Should return: {"status": "ok"}
```

### LiveKit Client SDK

The LiveKit JavaScript SDK is included in the frontend dependencies and will be installed with `npm install`.

## 5. Environment Variables and Configuration

### Backend Environment Variables

Create `backend/.env` file:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/pixie_ai_dev?schema=public"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-here-minimum-32-characters"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here-minimum-32-characters"

# LiveKit Configuration
LIVEKIT_API_KEY="your-livekit-api-key-here"
LIVEKIT_API_SECRET="your-livekit-api-secret-here"
LIVEKIT_WS_URL="ws://localhost:7880"

# Security
NODE_ENV="development"
CORS_ORIGIN="http://localhost:3000"

# Redis (Optional)
REDIS_URL="redis://localhost:6379"

# Password Policy
MIN_PASSWORD_LENGTH=12
REQUIRE_UPPERCASE=true
REQUIRE_LOWERCASE=true
REQUIRE_NUMBERS=true
REQUIRE_SPECIAL_CHARS=true

# Session Configuration
SESSION_TIMEOUT_MINUTES=480  # 8 hours
REFRESH_TOKEN_EXPIRY_DAYS=7

# Logging
LOG_LEVEL="debug"
```

### Frontend Environment Variables

Create `frontend/.env.local` file:

```bash
# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3030"
NEXT_PUBLIC_LIVEKIT_WS_URL="ws://localhost:7880"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here-minimum-32-characters"

# LiveKit Client Configuration
NEXT_PUBLIC_LIVEKIT_API_KEY="your-livekit-api-key-here"

# Development
NODE_ENV="development"
```

### Security Key Generation

Generate secure random keys for production use:

```bash
# Generate JWT secrets (32+ characters)
openssl rand -base64 32

# Generate NextAuth secret
openssl rand -hex 32

# Generate LiveKit API credentials
openssl rand -hex 16  # API Key
openssl rand -hex 32  # API Secret
```

## 6. Backend Setup (Feathers.js)

### Directory Structure

```
backend/
├── src/
│   ├── services/           # Business logic services
│   ├── hooks/             # Authentication and authorization
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── prisma/
└── tests/                 # Test suites
```

### Installation and Setup

1. **Navigate to backend directory:**

```bash
cd backend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Generate Prisma client:**

```bash
npx prisma generate
```

4. **Run database migrations:**

```bash
npx prisma migrate dev --name init
```

5. **Seed the database (if applicable):**

```bash
npx prisma db seed
```

6. **Build the application:**

```bash
npm run build
```

## 7. Frontend Setup (Next.js)

### Directory Structure

```
frontend/
├── app/                   # Next.js 15 App Router
│   ├── api/              # API routes
│   ├── broadcast/        # Broadcasting pages
│   ├── p2p/             # Peer-to-peer communication
│   └── components/       # Reusable UI components
├── contexts/             # React contexts
└── types/               # TypeScript definitions
```

### Installation and Setup

1. **Navigate to frontend directory:**

```bash
cd frontend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Build the application:**

```bash
npm run build
```

## 8. Testing Framework Setup

### Backend Testing (Jest)

**Configuration Files:**

- `backend/jest.config.mjs` - Jest configuration
- `backend/jest.setup.mjs` - Test setup and global mocks

**Running Tests:**

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx jest authentication.test.ts

# Run tests for specific service
npx jest services/authentication
```

**Test Categories:**

- **Unit Tests**: Individual service and utility functions
- **Integration Tests**: Database operations and API endpoints
- **Authentication Tests**: JWT, password validation, session management
- **Security Tests**: Authorization, input validation, RBAC

### Frontend Testing (Jest + React Testing Library)

**Running Tests:**

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**Test Categories:**

- **Component Tests**: UI components and user interactions
- **API Tests**: Frontend API route handlers
- **Integration Tests**: LiveKit connection and real-time features

### Test Data Management

**Database Test Data:**

- Test data is automatically seeded before each test run
- Database is reset between tests to ensure isolation
- Mock data generators for consistent test scenarios

## 9. Development Server Startup

### Start All Services

1. **Start PostgreSQL (if not already running):**

```bash
docker start pixie-postgres
```

2. **Start Redis (if using):**

```bash
redis-server
# or for Ubuntu/Debian:
sudo systemctl start redis-server
```

3. **Start LiveKit server (in separate terminal):**

```bash
cd ~/
livekit
livekit --config config/livekit-server.yaml
```

4. **Start backend development server:**

```bash
cd backend
npm run dev
# Backend will be available at http://localhost:3030
```

5. **Start frontend development server (in separate terminal):**

```bash
cd frontend
npm run dev
# Frontend will be available at http://localhost:3000
```

### Service Verification

**Backend Health Check:**

```bash
curl http://localhost:3030/health
# Should return: {"status": "healthy"}
```

**Frontend Health Check:**

- Navigate to http://localhost:3000 in your browser
- Should load the application without errors

**LiveKit Health Check:**

```bash
curl http://localhost:7880/api/health
# Should return: {"status": "ok"}
```

## 10. Verification Steps

### Database Verification

1. **Check database connection:**

```bash
cd backend
npx prisma studio
# Opens browser-based database viewer at http://localhost:5555
```

2. **Verify migrations:**

```bash
npx prisma migrate status
# Should show all migrations as applied
```

3. **Check data seeding:**

```bash
npx prisma db seed
# If applicable, verify seed data exists
```

### API Verification

1. **Authentication endpoints:**

```bash
# Register new user
curl -X POST http://localhost:3030/authentication \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}'

# Login
curl -X POST http://localhost:3030/authentication \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "strategy": "local"}'
```

2. **LiveKit token generation:**

```bash
curl -X POST http://localhost:3000/api/livekit-token \
  -H "Content-Type: application/json" \
  -d '{"roomName": "test-room", "participantName": "test-user"}'
```

### Real-time Communication Verification

1. **Create a test session:**

```bash
curl -X POST http://localhost:3030/sessions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Session", "description": "Testing real-time features"}'
```

2. **Join session via WebSocket:**

- Open browser developer tools
- Navigate to a broadcast or P2P page
- Check WebSocket connection to LiveKit server

## 11. Troubleshooting Guide

### Common Issues and Solutions

#### Database Connection Issues

**Problem:** `P1001: Can't reach database server`

```
Solution:
1. Verify PostgreSQL container is running: docker ps | grep pixie-postgres
2. Check database logs: docker logs pixie-postgres
3. Restart container: docker restart pixie-postgres
4. Verify port 5432 is not in use: lsof -i :5432
```

**Problem:** `P3001: Migration failed`

```
Solution:
1. Reset database: docker exec pixie-postgres dropdb -U postgres pixie_ai_dev
2. Recreate database: docker exec pixie-postgres createdb -U postgres pixie_ai_dev
3. Re-run migrations: npx prisma migrate dev
```

#### LiveKit Server Issues

**Problem:** `Connection refused on port 7880`

```
Solution:
1. Verify LiveKit server is running: ps aux | grep livekit
2. Check LiveKit logs for errors
3. Verify configuration file exists and is valid
4. Check if required ports (7880-7900) are available
```

**Problem:** `WebRTC connection failed`

```
Solution:
1. Verify UDP port range is available (7881-7900)
2. Check firewall settings for UDP traffic
3. Verify LiveKit WebSocket URL in environment variables
4. Check browser console for WebRTC-specific errors
```

#### Authentication Issues

**Problem:** `JWT token verification failed`

```
Solution:
1. Verify JWT_SECRET environment variable is set
2. Check token expiration (default: 15 minutes)
3. Verify token format and signature
4. Check if user exists in database
```

**Problem:** `Password validation failed`

```
Solution:
1. Ensure password meets requirements (12+ chars, mixed case, numbers, special chars)
2. Check password validation service logs
3. Verify password policies in environment variables
```

#### Build and Compilation Issues

**Problem:** `TypeScript compilation errors`

```
Solution:
1. Run type checking: npx tsc --noEmit
2. Check for missing dependencies
3. Verify Node.js and TypeScript versions
4. Clear node_modules and reinstall: rm -rf node_modules && npm install
```

**Problem:** `Module not found errors`

```
Solution:
1. Install missing dependencies: npm install
2. Check import paths for typos
3. Verify file extensions (.ts, .tsx, .js)
4. Check case sensitivity in file names
```

#### Performance Issues

**Problem:** `Slow database queries`

```
Solution:
1. Check query performance with: npx prisma studio
2. Add database indexes if needed
3. Enable query logging: set LOG_LEVEL=debug
4. Monitor with: npx prisma query-engine --version
```

**Problem:** `High memory usage`

```
Solution:
1. Monitor Node.js processes: npm install -g clinic && clinic doctor -- node server.js
2. Check for memory leaks in services
3. Optimize database connections
4. Enable Redis caching for session storage
```

### Getting Help

If you encounter issues not covered in this guide:

1. **Check application logs:**

   - Backend: Check terminal output for error messages
   - Frontend: Open browser developer tools console
   - LiveKit: Check LiveKit server logs

2. **Database debugging:**

   - Use Prisma Studio: `npx prisma studio`
   - Check database logs: `docker logs pixie-postgres`

3. **Network debugging:**

   - Test API endpoints with Postman or curl
   - Check WebSocket connections in browser dev tools
   - Verify all services are running on correct ports

4. **Environment verification:**
   - Double-check all environment variables
   - Verify file paths and permissions
   - Check for typos in configuration files

### Development Best Practices

1. **Environment Management:**

   - Use separate .env files for different environments
   - Never commit secrets to version control
   - Use environment-specific configuration

2. **Database Management:**

   - Always backup before schema changes
   - Test migrations on development database first
   - Use descriptive migration names

3. **Security:**

   - Generate strong, unique secrets for each environment
   - Regularly rotate JWT secrets
   - Monitor for suspicious authentication attempts

4. **Performance:**

   - Monitor resource usage during development
   - Test with realistic data volumes
   - Profile slow operations early

5. **Code Quality:**
   - Run tests before committing changes
   - Follow TypeScript strict mode guidelines
   - Use meaningful variable and function names

---
