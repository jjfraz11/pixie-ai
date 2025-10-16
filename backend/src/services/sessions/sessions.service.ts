import { Type } from '@feathersjs/typebox';
import { Application, Params } from '@feathersjs/feathers';
import { Conflict, GeneralError, Forbidden, NotFound, BadRequest } from '@feathersjs/errors';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import prisma from '@/prisma'; // Import prisma
import { authorize } from '@/hooks/authorization';

// Define the API response type after mapping sessionId to id
interface SessionResponse {
  id: string;
  type: string;
  accessType: string;
  password?: string | null;
  hostId: string;
  createdAt: string; // Serialized as date-time string
}

interface AuthenticatedParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

// Schema for creating new sessions
export const sessionDataSchema = Type.Object({
  type: Type.Union([Type.Literal('p2p'), Type.Literal('broadcast')]),
  hostId: Type.String(),
  accessType: Type.Optional(Type.Union([Type.Literal('PUBLIC'), Type.Literal('PRIVATE')])),
  password: Type.Optional(Type.String()),
});

// Schema for the response data
const sessionResultSchemaDefinition = {
  id: Type.String(),
  type: Type.String(),
  hostId: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
};

export const sessionResultSchema = Type.Object(sessionResultSchemaDefinition);

// Schema for allowed query properties
export const sessionQuerySchema = Type.Object({
  hostId: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),

  // Common query parameters, manually defined
  $limit: Type.Optional(Type.Number({ minimum: 0 })),
  $skip: Type.Optional(Type.Number({ minimum: 0 })),
  $sort: Type.Optional(
    Type.Object({
      id: Type.Optional(Type.Number()),
      type: Type.Optional(Type.Number()),
      hostId: Type.Optional(Type.Number()),
      createdAt: Type.Optional(Type.Number()),
    }),
  ),
});

interface SessionServiceOptions {
  paginate?: {
    default: number;
    max: number;
  };
}

// The actual service class
class SessionService {
  options: SessionServiceOptions;
  app: Application;

  constructor(options: SessionServiceOptions, app: Application) {
    this.options = options || {};
    this.app = app;
  }

  async find(params?: AuthenticatedParams): Promise<SessionResponse[]> {
    return [];
  }

  async get(id: string, params?: AuthenticatedParams): Promise<SessionResponse> {
    try {
      const session = await prisma.session.findUnique({
        where: { id },
      });
      if (!session) {
        throw new NotFound('Session not found');
      }

      // Check password for private sessions
      if (session.accessType === 'PRIVATE') {
        const providedPassword = params?.query?.password;
        if (!providedPassword) {
          throw new Forbidden('Password required for this private session.');
        }
        const isPasswordValid = await bcrypt.compare(providedPassword, session.password || '');
        if (!isPasswordValid) {
          throw new Forbidden('Incorrect password for this private session.');
        }
      }

      // Map sessionId to id for API response and serialize dates
      const { password, ...rest } = session; // Exclude password from response
      return {
        ...rest,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error instanceof NotFound || error instanceof Forbidden) {
        throw error;
      }
      throw new GeneralError('Failed to get session', error);
    }
  }

  async create(data: any, params?: AuthenticatedParams): Promise<SessionResponse> {
    if (data.type !== 'P2P' && data.type !== 'BROADCAST') {
      console.log({ badRequestData: data });
      throw new BadRequest('Invalid session type. Must be either "P2P" or "BROADCAST"');
    }

    let passwordHash = undefined;
    if (data.accessType === 'PRIVATE' && data.password) {
      passwordHash = await bcrypt.hash(data.password, 12);
    } else if (data.accessType === 'PRIVATE' && !data.password) {
      throw new BadRequest('Private sessions require a password.');
    }

    // Create the session in the database
    try {
      const liveKitRoomId = `lk-${uuidv4()}`;
      const newSession = await prisma.session.create({
        data: {
          ...data,
          type: data.type === 'P2P' ? 'P2P' : 'BROADCAST',
          accessType: data.accessType || 'PUBLIC',
          passwordHash,
          maxParticipants: data.type === 'broadcast' ? 1000 : 10, // Default to 1000 for broadcast, 10 for P2P
          liveKitRoomId,
        },
      });

      // Create a participant entry for the host
      await this.app.service('participants').create({
        sessionId: newSession.id,
        userId: newSession.hostId,
        participantIdentity: newSession.hostId, // Use hostId as identity for now
        displayName: params?.user?.id || 'Host', // Use user ID as display name
        role: 'HOST',
      });

      // Map sessionId to id for API response and serialize dates
      const { ...rest } = newSession;
      return {
        ...rest,
        id: newSession.id,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Prisma unique constraint violation
        throw new Conflict('Session already exists');
      }
      throw new GeneralError('Failed to create session', error);
    }
  }

  async patch(id: string, data: any, params?: AuthenticatedParams): Promise<SessionResponse> {
    try {
      const updatedSession = await prisma.session.update({
        where: { id },
        data,
      });
      // Map sessionId to id for API response and serialize dates
      const { ...rest } = updatedSession;
      return {
        ...rest,
        id: updatedSession.id,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma record not found
        throw new GeneralError('Session not found');
      }
      throw new GeneralError('Failed to update session', error);
    }
  }

  async remove(id: string, params?: AuthenticatedParams): Promise<SessionResponse> {
    try {
      const deletedSession = await prisma.session.delete({
        where: { id },
      });
      // Map sessionId to id for API response and serialize dates
      const { ...rest } = deletedSession;
      return {
        ...rest,
        id: deletedSession.id,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Prisma record not found
        throw new GeneralError('Session not found');
      }
      throw new GeneralError('Failed to delete session', error);
    }
  }
}

export default function configureSessionsService(app: Application) {
  const sessionServiceOptions = {
    paginate: {
      default: 10,
      max: 50,
    },
  };
  const sessionsService = new SessionService(sessionServiceOptions, app);

  app.use('sessions', sessionsService);

  app.service('sessions').hooks({
    before: {
      all: [authorize()], // Require authentication for all operations
      find: [],
      get: [],
      create: [
        // validate(sessionDataSchema),
        async (context: any) => {
          if (!context.data.hostId && context.params?.user) {
            context.data.hostId = context.params.user.id;
          }
          return context;
        },
        // Add RBAC validation for broadcast sessions
        async (context: any) => {
          if (context.data.type === 'broadcast') {
            if (!context.params.user || !context.params.user.roles.includes('broadcaster')) {
              throw new Forbidden('Only broadcasters can create broadcast sessions.');
            }
          }
          return context;
        },
      ],
      patch: [
        async (context: any) => {
          const session = await context.service.get(context.id);
          if (!context.params.user || session.hostId !== context.params.user.id) {
            throw new Forbidden('Only the session host can modify this session.');
          }
          return context;
        },
      ],
      remove: [
        async (context: any) => {
          const session = await context.service.get(context.id);
          if (!context.params.user || session.hostId !== context.params.user.id) {
            throw new Forbidden('Only the session host can remove this session.');
          }
          return context;
        },
      ],
    },
    after: {
      all: [
        async (context: any) => {
          const logger = context.app.get('logger');
          logger.info(`Session service method ${context.method} successful`, {
            correlationId: context.params.correlationId,
            method: context.method,
            path: context.path,
            userId: context.params.user?.id,
            result: context.result,
          });
          return context;
        },
      ],
      find: [],
      get: [],
      create: [],
      patch: [],
      remove: [],
    },
    error: {
      all: [
        async (context: any) => {
          const logger = context.app.get('logger');
          logger.error(`Error in session service on method ${context.method}:`, {
            correlationId: context.params.correlationId,
            method: context.method,
            path: context.path,
            userId: context.params.user?.id,
            error: context.error,
          });
          return context;
        },
      ],
    },
  });
}
