import { Application, Service, Params } from '@feathersjs/feathers';
import { AccessToken } from 'livekit-server-sdk';

interface LiveKitTokenData {
  sessionId: string;
  participantIdentity: string;
  participantName?: string;
  role?: 'viewer' | 'broadcaster' | 'host';
}

class LiveKitTokenService implements Service<any> {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: LiveKitTokenData, params?: Params): Promise<any> {
    const { sessionId, participantIdentity, participantName, role } = data;

    const livekitApiKey = this.app.get('livekit').apiKey;
    const livekitApiSecret = this.app.get('livekit').apiSecret;

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    at.addGrant({
      room: sessionId,
      roomJoin: true,
      canPublish: role === 'broadcaster' || role === 'host',
      canSubscribe: true,
    });

    return {
      token: at.toJwt(),
      wsUrl: this.app.get('livekit').wsUrl,
      participantIdentity,
    };
  }
}

export default function configureLiveKitTokenService(app: Application) {
  app.use('/livekit-token', new LiveKitTokenService(app));
}
