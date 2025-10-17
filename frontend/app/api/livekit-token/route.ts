import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, participantName, userId } = await req.json();

    if (!sessionId || !participantName || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, participantName, userId" },
        { status: 400 }
      );
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
      return NextResponse.json(
        { error: "LiveKit environment variables are not set" },
        { status: 500 }
      );
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: participantName,
    });

    at.addGrant({ room: sessionId, roomJoin: true, canPublish: true, canSubscribe: true });

    const token = at.toJwt();

    return NextResponse.json({ token, wsUrl: LIVEKIT_WS_URL });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
