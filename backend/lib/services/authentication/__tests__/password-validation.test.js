import assert from "assert";
import { validatePasswordStrength, validatePasswordLength, validatePasswordComplexity, getPasswordRequirements, } from "../utils/password-validation";
describe("Password Validation Utils", () => {
    describe("getPasswordRequirements()", () => {
        it("should return default requirements when no env vars set", () => {
            const requirements = getPasswordRequirements();
            assert.strictEqual(requirements.minLength, 8);
            assert.strictEqual(requirements.requireComplexity, true);
        });
        it("should respect MIN_PASSWORD_LENGTH env var", () => {
            process.env.MIN_PASSWORD_LENGTH = "12";
            const requirements = getPasswordRequirements();
            assert.strictEqual(requirements.minLength, 12);
            delete process.env.MIN_PASSWORD_LENGTH;
        });
        it("should respect REQUIRE_PASSWORD_COMPLEXITY env var", () => {
            process.env.REQUIRE_PASSWORD_COMPLEXITY = "false";
            const requirements = getPasswordRequirements();
            assert.strictEqual(requirements.requireComplexity, false);
            delete process.env.REQUIRE_PASSWORD_COMPLEXITY;
        });
    });
    describe("validatePasswordLength()", () => {
        it("should return true for password meeting minimum length", () => {
            assert.strictEqual(validatePasswordLength("password123", 8), true);
        });
        it("should return false for password below minimum length", () => {
            assert.strictEqual(validatePasswordLength("short", 8), false);
        });
        it("should return true for exact minimum length", () => {
            assert.strictEqual(validatePasswordLength("12345678", 8), true);
        });
    });
    describe("validatePasswordComplexity()", () => {
        it("should return true for password with all complexity requirements", () => {
            assert.strictEqual(validatePasswordComplexity("Strong123!"), true);
        });
        it("should return false for password without uppercase", () => {
            assert.strictEqual(validatePasswordComplexity("strong123!"), false);
        });
        it("should return false for password without lowercase", () => {
            assert.strictEqual(validatePasswordComplexity("STRONG123!"), false);
        });
        it("should return false for password without numbers", () => {
            assert.strictEqual(validatePasswordComplexity("Strong!"), false);
        });
        it("should return false for password without special characters", () => {
            assert.strictEqual(validatePasswordComplexity("Strong123"), false);
        });
        it("should return true for password with various special characters", () => {
            assert.strictEqual(validatePasswordComplexity("Strong123@"), true);
            assert.strictEqual(validatePasswordComplexity("Strong123#"), true);
            assert.strictEqual(validatePasswordComplexity("Strong123$"), true);
        });
    });
    describe("validatePasswordStrength()", () => {
        it("should return valid result for strong password", () => {
            const result = validatePasswordStrength("StrongPassword123!");
            assert.strictEqual(result.isValid, true);
            assert.deepStrictEqual(result.errors, []);
        });
        it("should return invalid result for password too short", () => {
            const result = validatePasswordStrength("short");
            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.errors.length, 2); // length and complexity
            assert.ok(result.errors[0].includes("at least"));
            assert.ok(result.errors[1].includes("contain"));
        });
        it("should return invalid result for password without complexity", () => {
            const result = validatePasswordStrength("longpasswordbutweak");
            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.errors.length, 1);
            assert.ok(result.errors[0].includes("contain"));
        });
        it("should respect custom requirements", () => {
            const result = validatePasswordStrength("weak", {
                minLength: 3,
                requireComplexity: false,
            });
            assert.strictEqual(result.isValid, true);
            assert.deepStrictEqual(result.errors, []);
        });
        it("should use default requirements when none provided", () => {
            const result = validatePasswordStrength("Short1!");
            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.errors.length, 1);
            assert.ok(result.errors[0].includes("at least"));
        });
    });
});
