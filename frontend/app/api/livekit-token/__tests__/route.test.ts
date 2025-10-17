import { NextRequest } from "next/server";

// Test constants
const STATUS_CODE_REQUEST_SUCCESSFUL = 200;
const STATUS_CODE_REQUEST_FAILED = 500;

// Mock livekit-server-sdk
const toJwtMock = jest.fn(() => 'mock-livekit-token');
jest.mock('livekit-server-sdk', () => ({
  AccessToken: jest.fn().mockImplementation(() => ({
    addGrant: jest.fn().mockReturnThis(),
    toJwt: toJwtMock,
  })),
}));

// Mock next/server
jest.mock('next/server', () => ({
    ...jest.requireActual('next/server'),
    NextResponse: {
        json: jest.fn().mockImplementation((data, options) => {
            return {
                json: () => Promise.resolve(data),
                status: options?.status || 200,
            };
        }),
    },
}));

describe("/api/livekit-token", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    toJwtMock.mockClear();
    toJwtMock.mockReturnValue('mock-livekit-token');
  });

  afterAll(() => {
    process.env = originalEnv;
  });


  it("generates a LiveKit token successfully", async () => {
    process.env.LIVEKIT_API_KEY = "test-api-key";
    process.env.LIVEKIT_API_SECRET = "test-api-secret";
    process.env.LIVEKIT_WS_URL = "ws://localhost:7880";

    const { POST } = await import("../route");

    const requestBody = {
      sessionId: "test-session-id",
      participantName: "Test User",
      userId: "test-user-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(STATUS_CODE_REQUEST_SUCCESSFUL);
    expect(data).toEqual({
      token: "mock-livekit-token",
      wsUrl: "ws://localhost:7880",
    });
  });

  it("returns 400 for missing required fields", async () => {
    process.env.LIVEKIT_API_KEY = "test-api-key";
    process.env.LIVEKIT_API_SECRET = "test-api-secret";
    process.env.LIVEKIT_WS_URL = "ws://localhost:7880";

    const { POST } = await import("../route");

    const requestBody = {
      // Missing required fields
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields: sessionId, participantName, userId");
  });

  it("returns 500 for internal server error", async () => {
    process.env.LIVEKIT_API_KEY = "test-api-key";
    process.env.LIVEKIT_API_SECRET = "test-api-secret";
    process.env.LIVEKIT_WS_URL = "ws://localhost:7880";

    const { POST } = await import("../route");

    toJwtMock.mockImplementationOnce(() => {
      throw new Error("JWT signing failed");
    });

    const requestBody = {
      sessionId: "test-session-id",
      participantName: "Test User",
      userId: "test-user-id",
    };

    const request = new NextRequest("http://localhost:3000/api/livekit-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(STATUS_CODE_REQUEST_FAILED);
    expect(data.error).toBe("Internal server error");
  });

  it('should return 500 if LiveKit env vars are not set', async () => {
    const { POST } = await import("../route");
    const requestBody = {
        sessionId: "test-session-id",
        participantName: "Test User",
        userId: "test-user-id",
      };
  
      const request = new NextRequest("http://localhost:3000/api/livekit-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
  
      const response = await POST(request);
      const data = await response.json();
  
      expect(response.status).toBe(500);
      expect(data.error).toBe('LiveKit environment variables are not set');
  })
});
