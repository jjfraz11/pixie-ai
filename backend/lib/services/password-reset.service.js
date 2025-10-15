import { BadRequest, GeneralError } from "@feathersjs/errors";
import prisma from "../prisma";
import crypto from "crypto";
import bcrypt from "bcrypt";
class PasswordResetService {
    constructor(options, app) {
        this.options = {
            resetTokenExpirationMinutes: 60, // 1 hour default
            rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
            rateLimitMaxRequests: 5, // 5 requests per 15 minutes
            minPasswordLength: 8,
            requirePasswordComplexity: true,
            ...options,
        };
        this.app = app;
        this.rateLimitMap = new Map();
    }
    async find(params) {
        throw new GeneralError("Method not implemented");
    }
    async get(id, params) {
        throw new GeneralError("Method not implemented");
    }
    async create(data, params) {
        const { action, email, token, newPassword } = data;
        if (action === "request") {
            return this.requestPasswordReset(email);
        }
        else if (action === "change") {
            return this.changePassword(token, newPassword);
        }
        throw new BadRequest("Invalid action");
    }
    async update(id, data, params) {
        throw new GeneralError("Method not implemented");
    }
    async patch(id, data, params) {
        throw new GeneralError("Method not implemented");
    }
    async remove(id, params) {
        throw new GeneralError("Method not implemented");
    }
    async requestPasswordReset(email) {
        try {
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new BadRequest("Invalid email format");
            }
            // Check rate limiting
            const currentTime = Date.now();
            const rateLimitKey = `reset_request_${email}`;
            let rateLimitEntry = this.rateLimitMap.get(rateLimitKey);
            if (!rateLimitEntry || currentTime > rateLimitEntry.resetTime) {
                rateLimitEntry = {
                    count: 0,
                    resetTime: currentTime + this.options.rateLimitWindowMs,
                };
            }
            if (rateLimitEntry.count >= this.options.rateLimitMaxRequests) {
                this.logSecurityEvent("rate_limit_exceeded", { email });
                throw new BadRequest("Too many password reset requests. Please try again later.");
            }
            rateLimitEntry.count++;
            this.rateLimitMap.set(rateLimitKey, rateLimitEntry);
            const user = await prisma.user.findUnique({
                where: { email },
            });
            if (!user) {
                // Don't reveal if user exists or not - return same success message
                return {
                    success: true,
                    message: "If an account with that email exists, a password reset email has been sent.",
                };
            }
            // Generate reset token using crypto.randomBytes
            const resetToken = crypto.randomBytes(32).toString("hex");
            const resetTokenExpires = new Date(Date.now() + this.options.resetTokenExpirationMinutes * 60 * 1000);
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    resetToken,
                    resetTokenExpires,
                },
            });
            this.logSecurityEvent("password_reset_requested", {
                userId: user.id,
                email,
            });
            // TODO: Send email with reset token
            // For now, we'll just return success
            // In a real implementation, integrate with an email service
            return {
                success: true,
                message: "If an account with that email exists, a password reset email has been sent.",
            };
        }
        catch (error) {
            if (error instanceof BadRequest) {
                throw error;
            }
            this.logSecurityEvent("password_reset_request_failed", {
                email,
                error: error.message,
            });
            throw new GeneralError("Failed to request password reset", error);
        }
    }
    async changePassword(token, newPassword) {
        try {
            // Validate password strength
            if (newPassword.length < this.options.minPasswordLength) {
                throw new BadRequest(`Password must be at least ${this.options.minPasswordLength} characters long`);
            }
            if (this.options.requirePasswordComplexity) {
                const hasUpperCase = /[A-Z]/.test(newPassword);
                const hasLowerCase = /[a-z]/.test(newPassword);
                const hasNumbers = /\d/.test(newPassword);
                const hasNonalphas = /\W/.test(newPassword);
                if (!(hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas)) {
                    throw new BadRequest("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
                }
            }
            const user = await prisma.user.findFirst({
                where: {
                    resetToken: token,
                    resetTokenExpires: {
                        gt: new Date(),
                    },
                },
            });
            if (!user) {
                this.logSecurityEvent("password_reset_failed", {
                    token: token.substring(0, 8) + "...",
                    reason: "invalid_token",
                });
                throw new BadRequest("Invalid or expired reset token");
            }
            // Hash the new password using bcrypt
            const passwordHash = await bcrypt.hash(newPassword, 12); // Increased rounds for better security
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: passwordHash,
                    resetToken: null,
                    resetTokenExpires: null,
                },
            });
            this.logSecurityEvent("password_reset_successful", { userId: user.id });
            return {
                success: true,
                message: "Password changed successfully",
            };
        }
        catch (error) {
            if (error instanceof BadRequest) {
                throw error;
            }
            this.logSecurityEvent("password_reset_failed", { error: error.message });
            throw new GeneralError("Failed to change password", error);
        }
    }
    logSecurityEvent(event, details) {
        const timestamp = new Date().toISOString();
        console.log(`[SECURITY:${timestamp}] ${event}:`, JSON.stringify(details));
        // In a production environment, this would be logged to a security monitoring system
    }
    async cleanupExpiredTokens() {
        try {
            const result = await prisma.user.updateMany({
                where: {
                    resetToken: { not: null },
                    resetTokenExpires: { lt: new Date() },
                },
                data: {
                    resetToken: null,
                    resetTokenExpires: null,
                },
            });
            if (result.count > 0) {
                this.logSecurityEvent("expired_tokens_cleaned", {
                    count: result.count,
                });
            }
        }
        catch (error) {
            console.error("Failed to cleanup expired tokens:", error);
        }
    }
}
export default function configurePasswordResetService(app) {
    const options = {
        paginate: app.get("paginate"),
        resetTokenExpirationMinutes: parseInt(process.env.RESET_TOKEN_EXPIRATION_MINUTES || "60"),
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "5"),
        minPasswordLength: parseInt(process.env.MIN_PASSWORD_LENGTH || "8"),
        requirePasswordComplexity: process.env.REQUIRE_PASSWORD_COMPLEXITY !== "false", // default true
    };
    app.use("/password-reset", new PasswordResetService(options, app));
    const service = app.service("password-reset");
    // Schedule periodic cleanup of expired tokens (every hour)
    setInterval(() => {
        const passwordResetService = app.service("password-reset");
        passwordResetService.cleanupExpiredTokens();
    }, 60 * 60 * 1000); // 1 hour
    // Note: No authentication required for password reset endpoints
    // as users need to reset their passwords when they can't log in
}
