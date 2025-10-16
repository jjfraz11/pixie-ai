import assert from "assert";
import app from "../../../app";
import { setupTestEnvironment, teardownTestEnvironment, createTestUser, makeApiRequest, DEFAULT_PASSWORD_STRONG, DEFAULT_PASSWORD_WEAK, } from "../../../test-utils";
describe("Users Service", () => {
    let port;
    let userService;
    before(async () => {
        const setup = await setupTestEnvironment();
        port = setup.port;
        userService = app.service("users");
    });
    after(async () => {
        const services = {
            users: userService,
            sessions: null,
            participants: null,
        };
        await teardownTestEnvironment(services);
    });
    describe("User Registration", () => {
        it("should register a new user with valid data", async () => {
            const email = `testuser_${Date.now()}@example.com`;
            const response = await makeApiRequest(port, "/users", {
                email: email,
                password: DEFAULT_PASSWORD_STRONG,
            });
            assert.strictEqual(response.status, 201);
            assert.strictEqual(response.data.email, email);
        });
        it("should not register a user with an existing email", async () => {
            const email = `testuser_${Date.now()}@example.com`;
            await createTestUser(userService, email, DEFAULT_PASSWORD_STRONG);
            const response = await makeApiRequest(port, "/users", {
                email: email,
                password: DEFAULT_PASSWORD_STRONG,
            });
            assert.strictEqual(response.status, 409);
        });
        it("should not register a user with a weak password", async () => {
            const email = `testuser_${Date.now()}@example.com`;
            const response = await makeApiRequest(port, "/users", {
                email: email,
                password: DEFAULT_PASSWORD_WEAK,
            });
            assert.strictEqual(response.status, 400);
        });
    });
});
