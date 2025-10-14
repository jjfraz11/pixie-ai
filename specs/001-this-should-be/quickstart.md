# Quickstart Guide: Real-time Communication Platform

This guide provides instructions for setting up and running the project for local development.

## 1. Prerequisites

*   **Node.js**: v18 or later
*   **npm** or **yarn**
*   **Docker**: For running a local PostgreSQL database.

## 2. Backend Setup (Feathers.js + Prisma)

The backend handles API services, authentication, and database access.

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Set up the database**:
    *   Start a PostgreSQL database using Docker:
        ```bash
        docker run --name pixie-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
        ```
    *   Create a `.env` file in the `backend` directory.
    *   Add the database connection string to your `.env` file:
        ```
        DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/postgres?schema=public"
        ```

4.  **Run database migrations**:
    This command will create the database tables based on the schema in `prisma/schema.prisma`.
    ```bash
    npx prisma migrate dev --name init
    ```

5.  **Start the backend server**:
    ```bash
    npm run dev
    ```
    The backend will be running at `http://localhost:3030`.

## 3. Frontend Setup (Next.js)

The frontend is a Next.js application with the App Router.

1.  **Navigate to the frontend directory**:
    ```bash
    cd frontend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the frontend server**:
    ```bash
    npm run dev
    ```
    The frontend will be running at `http://localhost:3000`.
