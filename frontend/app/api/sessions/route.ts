import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3030';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'dev-api-key';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'dev-api-secret';
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'ws://localhost:7880';

interface CreateSessionRequest {
  type: 'p2p' | 'broadcast';
  title?: string;
}

interface LiveKitTokenPayload {
  exp: number;
  iss: string;
  nbf: number;
  sub: string;
  aud: string;
  room: string;
  name?: string;
  identity: string;
  metadata?: string;
  kind?: 'publisher' | 'subscriber';
  video?: {
    room?: string;
    roomJoin?: boolean;
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();
    const { type, title } = body;

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Session type is required' },
        { status: 400 }
      );
    }

    if (!['p2p', 'broadcast'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid session type. Must be either "p2p" or "broadcast"' },
        { status: 400 }
      );
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify JWT token (in a real app, you'd verify the signature)
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Forward the request to the backend to create the session
    const backendResponse = await fetch(`${BACKEND_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader, // Forward the authorization header
      },
      body: JSON.stringify({ type, title }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(errorData, { status: backendResponse.status });
    }

    const session = await backendResponse.json();

    // For broadcast sessions, we might also want to generate a LiveKit room
    if (type === 'broadcast') {
      // Generate LiveKit room token for the broadcaster
      const roomName = `broadcast-${session.id}`;
      const now = Math.floor(Date.now() / 1000);

      const tokenPayload: LiveKitTokenPayload = {
        exp: now + 3600, // Token expires in 1 hour
        iss: LIVEKIT_API_KEY,
        nbf: now,
        sub: session.hostId, // Use actual hostId from created session
        aud: 'livekit',
        room: roomName,
        name: title || 'Broadcaster',
        identity: session.hostId, // Use actual hostId from created session
        kind: 'publisher', // For P2P calls, both participants can publish
        video: {
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: false, // Broadcaster doesn't need to subscribe to their own stream
          canPublishData: true,
        },
      };

      const livekitToken = jwt.sign(tokenPayload, LIVEKIT_API_SECRET, {
        algorithm: 'HS256',
        header: {
          alg: 'HS256',
          typ: 'JWT',
          kid: LIVEKIT_API_KEY,
        },
      });

      // Include LiveKit info in the session response
      session.livekitToken = livekitToken;
      session.roomName = roomName;
      session.wsUrl = LIVEKIT_WS_URL;
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}