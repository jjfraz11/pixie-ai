import { querySyntax, resolve } from "@feathersjs/schema";
import { Type } from "@feathersjs/typebox";
import { Application, Params } from "@feathersjs/feathers";
import prisma from "../../prisma"; // Import prisma
import { Conflict, GeneralError, Forbidden } from "@feathersjs/errors";
import { authorize } from "../../hooks/authorization";
import { Session } from "@prisma/client";

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
  type: Type.Union([Type.Literal("p2p"), Type.Literal("broadcast")]),
  hostId: Type.String(),
});

// Schema for the response data
const sessionResultSchemaDefinition = {
  id: Type.String(),
  type: Type.String(),
  hostId: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
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
    })
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
  prisma: typeof prisma; // Add prisma property

  constructor(options: SessionServiceOptions) {
    this.options = options || {};
    this.prisma = prisma; // Initialize prisma
  }

  async find(params?: AuthenticatedParams): Promise<SessionResponse[]> {
    return [];
  }

  async get(
    id: string,
    params?: AuthenticatedParams
  ): Promise<SessionResponse> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { sessionId: id },
      });
      if (!session) {
        throw new GeneralError("Session not found");
      }
      // Map sessionId to id for API response and serialize dates
      const { sessionId, ...rest } = session;
      return {
        id: sessionId,
        ...rest,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      throw new GeneralError("Failed to get session", error);
    }
  }

  async create(
    data: any,
    params?: AuthenticatedParams
  ): Promise<SessionResponse> {
    if (data.type !== "p2p" && data.type !== "broadcast") {
      throw new Error(
        'Invalid session type. Must be either "p2p" or "broadcast"'
      );
    }

    if (data.type === "p2p") {
      // P2P sessions should enforce max 2 participants
      // This will be enforced in the participants service
    }

    // Create the session in the database
    try {
      const newSession = await this.prisma.session.create({
        data: {
          ...data,
          type: data.type === "p2p" ? "P2P" : "BROADCAST",
        },
      });
      // Map sessionId to id for API response and serialize dates
      const { sessionId, ...rest } = newSession;
      return {
        id: sessionId,
        ...rest,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === "P2002") {
        // Prisma unique constraint violation
        throw new Conflict("Session already exists");
      }
      throw new GeneralError("Failed to create session", error);
    }
  }

  async patch(
    id: string,
    data: any,
    params?: AuthenticatedParams
  ): Promise<SessionResponse> {
    try {
      const updatedSession = await this.prisma.session.update({
        where: { sessionId: id },
        data,
      });
      // Map sessionId to id for API response and serialize dates
      const { sessionId, ...rest } = updatedSession;
      return {
        id: sessionId,
        ...rest,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === "P2025") {
        // Prisma record not found
        throw new GeneralError("Session not found");
      }
      throw new GeneralError("Failed to update session", error);
    }
  }

  async remove(
    id: string,
    params?: AuthenticatedParams
  ): Promise<SessionResponse> {
    try {
      const deletedSession = await this.prisma.session.delete({
        where: { sessionId: id },
      });
      // Map sessionId to id for API response and serialize dates
      const { sessionId, ...rest } = deletedSession;
      return {
        id: sessionId,
        ...rest,
        type: rest.type.toString(),
        accessType: rest.accessType.toString(),
        createdAt: rest.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.code === "P2025") {
        // Prisma record not found
        throw new GeneralError("Session not found");
      }
      throw new GeneralError("Failed to delete session", error);
    }
  }
}

export default function (app: Application) {
  app.use(
    "sessions",
    new SessionService({
      paginate: {
        default: 10,
        max: 50,
      },
    })
  );

  const service = app.service("sessions");

  service.hooks({
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
        // Remove RBAC for broadcast sessions - any authenticated user can create
      ],
      patch: [
        async (context: any) => {
          const session = await context.service.get(context.id);
          if (
            !context.params.user ||
            session.hostId !== context.params.user.id
          ) {
            throw new Forbidden(
              "Only the session host can modify this session."
            );
          }
          return context;
        },
      ],
      remove: [
        async (context: any) => {
          const session = await context.service.get(context.id);
          if (
            !context.params.user ||
            session.hostId !== context.params.user.id
          ) {
            throw new Forbidden(
              "Only the session host can remove this session."
            );
          }
          return context;
        },
      ],
    },
    after: {
      all: [],
      find: [],
      get: [],
      create: [],
      patch: [],
      remove: [],
    },
    error: {
      all: [
        async (context: any) => {
          console.error(
            `Error in session service on method ${context.method}:`,
            context.error
          );
          return context;
        },
      ],
    },
  });
}
