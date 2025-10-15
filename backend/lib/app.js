import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { feathers } from "@feathersjs/feathers";
import express, { json, urlencoded, static as serveStatic, rest, } from "@feathersjs/express";
import socketio from "@feathersjs/socketio";
import cors from "cors"; // Import cors
import helmet from "helmet"; // Import helmet
import rateLimit from "express-rate-limit"; // Import rateLimit
// In your app.js or equivalent
const app = express(feathers());
// Use Helmet.js for security headers
app.use(helmet());
// Enable CORS
app.use(cors());
// Parse HTTP JSON bodies
app.use(json());
// Parse URL-encoded params
app.use(urlencoded({ extended: true }));
// Host static files from the /public folder
app.use(serveStatic(join(__dirname, "public")));
// Add REST API support
app.configure(rest());
// Configure Socket.io real-time APIs
app.configure(socketio());
// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 authentication attempts per windowMs
    message: {
        error: "Too many authentication attempts from this IP, please try again after 15 minutes",
        code: "RATE_LIMIT_EXCEEDED",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for successful requests or development
        return process.env.NODE_ENV === "development";
    },
});
// Apply rate limiting to authentication routes
app.use("/authentication", authLimiter);
// Custom error handler
app.use((error, req, res, next) => {
    console.error("Custom Error Handler:", error); // Log the error
    const statusCode = error.statusCode || 500;
    const message = error.message || "An unexpected error occurred";
    // In production, avoid sending sensitive error details to the client
    const errorResponse = process.env.NODE_ENV === "production"
        ? { message: "An internal server error occurred." }
        : { message, ...error }; // Include full error in development
    res.status(statusCode).json(errorResponse);
});
import configureUsersService from "./services/users/users.service";
import configureSessionsService from "./services/sessions/sessions.service";
import configureAuthentication from "./services/authentication/authentication.service";
import configurePasswordResetService from "./services/password-reset.service";
// Set authentication configuration
app.set("authentication", {
    secret: process.env.AUTHENTICATION_SECRET || "fallback-secret-key-for-development",
    authStrategies: ["jwt", "local"],
    service: "users",
    entity: "user",
    entityId: "id",
    local: {
        usernameField: "email",
        passwordField: "password",
    },
});
// Configure authentication service
configureAuthentication(app);
app.configure(configureSessionsService);
app.configure(configureUsersService);
app.configure(configurePasswordResetService);
export default app;
