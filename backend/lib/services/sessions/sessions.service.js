import { Type } from "@feathersjs/typebox";
import prisma from "../../prisma"; // Import prisma
import { Conflict, GeneralError, Forbidden } from "@feathersjs/errors";
import { authorize } from "../../hooks/authorization";
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
    $sort: Type.Optional(Type.Object({
        id: Type.Optional(Type.Number()),
        type: Type.Optional(Type.Number()),
        hostId: Type.Optional(Type.Number()),
        createdAt: Type.Optional(Type.Number()),
    })),
});
// The actual service class
class SessionService {
    constructor(options) {
        this.options = options || {};
        this.prisma = prisma; // Initialize prisma
    }
    async find(params) {
        return [];
    }
    async get(id, params) {
        return { id };
    }
    async create(data, params) {
        if (data.type !== "p2p" && data.type !== "broadcast") {
            throw new Error('Invalid session type. Must be either "p2p" or "broadcast"');
        }
        if (data.type === "p2p") {
            // P2P sessions should enforce max 2 participants
            // This will be enforced in the participants service
        }
        // Create the session in the database
        try {
            const newSession = await this.prisma.session.create({ data });
            return newSession; // Return the created session with an ID
        }
        catch (error) {
            if (error.code === "P2002") {
                // Prisma unique constraint violation
                throw new Conflict("Session already exists");
            }
            throw new GeneralError("Failed to create session", error);
        }
    }
    async patch(id, data, params) {
        try {
            const updatedSession = await this.prisma.session.update({
                where: { sessionId: id },
                data,
            });
            return updatedSession;
        }
        catch (error) {
            if (error.code === "P2025") {
                // Prisma record not found
                throw new GeneralError("Session not found");
            }
            throw new GeneralError("Failed to update session", error);
        }
    }
    async remove(id, params) {
        try {
            const deletedSession = await this.prisma.session.delete({
                where: { sessionId: id },
            });
            return deletedSession;
        }
        catch (error) {
            if (error.code === "P2025") {
                // Prisma record not found
                throw new GeneralError("Session not found");
            }
            throw new GeneralError("Failed to delete session", error);
        }
    }
}
export default function (app) {
    app.use("sessions", new SessionService({
        paginate: {
            default: 10,
            max: 50,
        },
    }));
    const service = app.service("sessions");
    service.hooks({
        before: {
            all: [authorize()], // Require authentication for all operations
            find: [],
            get: [],
            create: [
                // validate(sessionDataSchema),
                async (context) => {
                    if (!context.data.hostId && context.params?.user) {
                        context.data.hostId = context.params.user.id;
                    }
                    return context;
                },
                // Additional RBAC for broadcast sessions
                async (context) => {
                    if (context.data.type === "broadcast") {
                        authorize(["broadcaster"])(context);
                    }
                    return context;
                },
            ],
            patch: [
                async (context) => {
                    const session = await context.service.get(context.id);
                    if (!context.params.user ||
                        session.hostId !== context.params.user.id) {
                        throw new Forbidden("Only the session host can modify this session.");
                    }
                    return context;
                },
            ],
            remove: [
                async (context) => {
                    const session = await context.service.get(context.id);
                    if (!context.params.user ||
                        session.hostId !== context.params.user.id) {
                        throw new Forbidden("Only the session host can remove this session.");
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
                async (context) => {
                    console.error(`Error in session service on method ${context.method}:`, context.error);
                    return context;
                },
            ],
        },
    });
}
