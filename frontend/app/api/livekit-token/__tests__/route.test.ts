import { NextRequest } from "next/server";
import { POST } from "../route";

// Test constants
const STATUS_CODE_REQUEST_SUCCESSFUL = 200;
const STATUS_CODE_REQUEST_FAILED = 500;

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "mock-livekit-token"),
}));

// Mock environment variables
process.env.LIVEKIT_API_KEY = "test-api-key";
process.env.LIVEKIT_API_SECRET = "test-api-secret";
process.env.LIVEKIT_WS_URL = "ws://localhost:7880";

describe("/api/livekit-token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a LiveKit token successfully", async () => {
    const requestBody = {
      roomName: "test-room",
      participantName: "Test User",
      participantIdentity: "test-user-id",
      sessionId: "test-session-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-jwt-token",
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(STATUS_CODE_REQUEST_SUCCESSFUL);
    expect(data).toEqual({
      token: "mock-livekit-token",
      wsUrl: "ws://localhost:7880",
      participantName: "Test User",
      participantIdentity: "test-user-id",
    });
  });

  it("returns 400 for missing required fields", async () => {
    const requestBody = {
      // Missing required fields
      participantName: "Test User",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-jwt-token",
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      "Missing required fields: roomName, participantName, participantIdentity, sessionId"
    );
  });

  it("returns 401 for missing authorization header", async () => {
    const requestBody = {
      roomName: "test-room",
      participantName: "Test User",
      participantIdentity: "test-user-id",
      sessionId: "test-session-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Missing Authorization header
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 for invalid authorization header format", async () => {
    const requestBody = {
      roomName: "test-room",
      participantName: "Test User",
      participantIdentity: "test-user-id",
      sessionId: "test-session-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "InvalidFormat", // Not Bearer format
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 for missing token in authorization header", async () => {
    const requestBody = {
      roomName: "test-room",
      participantName: "Test User",
      participantIdentity: "test-user-id",
      sessionId: "test-session-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ", // Empty token
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid token");
  });

  it("returns 500 for internal server error", async () => {
    // Mock JWT to throw an error
    const jwt = jest.requireMock("jsonwebtoken");
    jwt.sign.mockImplementation(() => {
      throw new Error("JWT signing failed");
    });

    const requestBody = {
      roomName: "test-room",
      participantName: "Test User",
      participantIdentity: "test-user-id",
      sessionId: "test-session-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-jwt-token",
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(STATUS_CODE_REQUEST_FAILED);
    expect(data.error).toBe("Internal server error");
  });
});
