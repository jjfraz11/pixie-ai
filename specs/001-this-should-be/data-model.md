```prisma
// This file represents the data model for the feature.
// It uses Prisma schema syntax for clarity and to be used by the Prisma ORM.

datasource db {
  provider = "postgresql" // A reasonable default, can be changed in .env
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Represents an authenticated user of the system.
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // Will be hashed by the Feathers.js authentication service
  roles     String[] // Can contain roles like 'user', 'broadcaster'
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Represents a communication session, either P2P or broadcast.
model Session {
  id        String   @id @default(cuid())
  // The type of session, e.g., "p2p" or "broadcast"
  type      String
  // The ID of the user who created the session
  hostId    String
  createdAt DateTime @default(now())
}
```
