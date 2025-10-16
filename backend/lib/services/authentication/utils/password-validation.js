/**
 * Gets the current password requirements from environment variables
 */
export function getPasswordRequirements() {
    return {
        minLength: parseInt(process.env.MIN_PASSWORD_LENGTH || "8"),
        requireComplexity: process.env.REQUIRE_PASSWORD_COMPLEXITY !== "false",
    };
}
/**
 * Validates the length of a password
 */
export function validatePasswordLength(password, minLength) {
    return password.length >= minLength;
}
/**
 * Validates the complexity of a password
 * Requires at least one uppercase letter, one lowercase letter, one number, and one special character
 */
export function validatePasswordComplexity(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    return hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
}
/**
 * Validates password strength according to the provided requirements
 */
export function validatePasswordStrength(password, requirements) {
    const config = requirements || getPasswordRequirements();
    const errors = [];
    // Check length
    if (!validatePasswordLength(password, config.minLength)) {
        errors.push(`Password must be at least ${config.minLength} characters long`);
    }
    // Check complexity if required
    if (config.requireComplexity && !validatePasswordComplexity(password)) {
        errors.push("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
