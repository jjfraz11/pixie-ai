import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// In a real application, these would come from environment variables
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'dev-api-key';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'dev-api-secret';
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'ws://localhost:7880';

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
    const body = await request.json();
    const { roomName, participantName, participantIdentity, sessionId } = body;

    // Validate required fields
    if (!roomName || !participantName || !participantIdentity || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, participantName, participantIdentity, sessionId' },
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

    // In a real app, you would:
    // 1. Verify the JWT signature and extract user info
    // 2. Check if the user is authorized to join this session
    // 3. Validate the session exists and user has access

    // Generate LiveKit token
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload: LiveKitTokenPayload = {
      exp: now + 3600, // Token expires in 1 hour
      iss: LIVEKIT_API_KEY,
      nbf: now,
      sub: participantIdentity,
      aud: 'livekit',
      room: roomName,
      name: participantName,
      identity: participantIdentity,
      metadata: JSON.stringify({
        sessionId,
        userId: participantIdentity, // In a real app, extract from JWT
      }),
      kind: 'publisher', // For P2P calls, both participants can publish
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    // Sign the token with LiveKit API secret
    const livekitToken = jwt.sign(tokenPayload, LIVEKIT_API_SECRET, {
      algorithm: 'HS256',
      header: {
        alg: 'HS256',
        typ: 'JWT',
        kid: LIVEKIT_API_KEY,
      },
    });

    return NextResponse.json({
      token: livekitToken,
      wsUrl: LIVEKIT_WS_URL,
      participantName,
      participantIdentity,
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
