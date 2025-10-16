import prisma from "../../prisma";
import { GeneralError, NotFound, Conflict, Forbidden } from "@feathersjs/errors";
import { authorize } from "../../hooks/authorization";
import { SessionType } from "@prisma/client";
class ParticipantService {
    constructor(options, app) {
        this.options = options;
        this.app = app;
    }
    async find(params) {
        try {
            const { sessionId, userId } = params?.query || {};
            return prisma.participant.findMany({ where: { sessionId, userId } });
        }
        catch (error) {
            throw new GeneralError("Failed to retrieve participants", error);
        }
    }
    async get(id, params) {
        try {
            const participant = await prisma.participant.findUnique({
                where: { id },
            });
            if (!participant) {
                throw new NotFound(`Participant with id '${id}' not found`);
            }
            return participant;
        }
        catch (error) {
            if (error instanceof NotFound) {
                throw error;
            }
            throw new GeneralError(`Failed to retrieve participant with id '${id}'`, error);
        }
    }
    async create(data, params) {
        try {
            const { sessionId, userId, participantIdentity, displayName, role } = data;
            // Fetch the session to check its type and participant limits
            const session = await prisma.session.findUnique({
                where: { id: sessionId },
            });
            if (!session) {
                throw new NotFound("Session not found.");
            }
            // Enforce 2-participant limit for P2P sessions
            if (session.type === SessionType.P2P) {
                const currentParticipants = await prisma.participant.count({
                    where: { sessionId },
                });
                if (currentParticipants >= 2) {
                    throw new Forbidden("P2P session is full (max 2 participants).");
                }
            }
            // Check if participant already exists in this session
            const existingParticipant = await prisma.participant.findFirst({
                where: { sessionId, participantIdentity },
            });
            if (existingParticipant) {
                throw new Conflict("Participant already joined this session.");
            }
            const newParticipant = await prisma.participant.create({
                data: {
                    sessionId,
                    userId,
                    participantIdentity,
                    displayName,
                    role,
                    joinedAt: new Date(),
                    lastActivityAt: new Date(),
                },
            });
            // Increment currentParticipants count in the session
            await prisma.session.update({
                where: { id: sessionId },
                data: {
                    currentParticipants: { increment: 1 },
                },
            });
            return newParticipant;
        }
        catch (error) {
            if (error instanceof NotFound || error instanceof Forbidden || error instanceof Conflict) {
                throw error;
            }
            throw new GeneralError("Failed to create participant", error);
        }
    }
    async update(id, data, params) {
        throw new GeneralError("Method not implemented");
    }
    async patch(id, data, params) {
        try {
            const updatedParticipant = await prisma.participant.update({
                where: { id: id },
                data: { ...data, lastActivityAt: new Date() },
            });
            return updatedParticipant;
        }
        catch (error) {
            if (error.code === "P2025") {
                throw new NotFound(`Participant with id '${id}' not found`);
            }
            throw new GeneralError(`Failed to patch participant with id '${id}'`, error);
        }
    }
    async remove(id, params) {
        try {
            const deletedParticipant = await prisma.participant.delete({
                where: { id: id },
            });
            // Decrement currentParticipants count in the session
            await prisma.session.update({
                where: { id: deletedParticipant.sessionId },
                data: {
                    currentParticipants: { decrement: 1 },
                },
            });
            return deletedParticipant;
        }
        catch (error) {
            if (error.code === "P2025") {
                throw new NotFound(`Participant with id '${id}' not found`);
            }
            throw new GeneralError(`Failed to remove participant with id '${id}'`, error);
        }
    }
}
export default function configureParticipantService(app) {
    const options = {
        paginate: app.get("paginate"),
    };
    app.use("/participants", new ParticipantService(options, app));
    const service = app.service("participants");
    service.hooks({
        before: {
            all: [authorize()],
            find: [],
            get: [],
            create: [
                async (context) => {
                    // Allow anonymous users to create participant entries for public broadcast sessions
                    if (!context.params.authentication) {
                        const session = await prisma.session.findUnique({
                            where: { id: context.data.sessionId },
                        });
                        if (session && session.accessType === "PUBLIC" && session.type === SessionType.BROADCAST) {
                            // Allow unauthenticated access for public broadcast sessions
                            context.params.user = undefined; // Ensure no user context is passed
                        }
                        else {
                            // For other session types or private sessions, require authentication
                            authorize()(context);
                        }
                    }
                    else {
                        // If authenticated, proceed with authorization
                        authorize()(context);
                    }
                    if (!context.data.userId && context.params?.user) {
                        context.data.userId = context.params.user.id;
                    }
                    if (!context.data.displayName && context.params?.user) {
                        context.data.displayName = context.params.user.email; // Default display name
                    }
                    if (!context.data.role) {
                        // Fetch the session to determine if it's a broadcast session
                        const session = await prisma.session.findUnique({
                            where: { id: context.data.sessionId },
                        });
                        if (session && session.type === SessionType.BROADCAST) {
                            context.data.role = "VIEWER";
                        }
                        else {
                            context.data.role = "GUEST"; // Default role for P2P or if session type is unknown
                        }
                    }
                    return context;
                },
            ],
            patch: [
                async (context) => {
                    const participant = await context.service.get(context.id);
                    if (!context.params.user ||
                        (participant.userId !== context.params.user.id &&
                            !context.params.user.roles.includes("ADMIN"))) {
                        throw new Forbidden("Only the participant or an admin can modify this participant.");
                    }
                    return context;
                },
            ],
            remove: [
                async (context) => {
                    const participant = await context.service.get(context.id);
                    if (!context.params.user ||
                        (participant.userId !== context.params.user.id &&
                            !context.params.user.roles.includes("ADMIN"))) {
                        throw new Forbidden("Only the participant or an admin can remove this participant.");
                    }
                    return context;
                },
            ],
        },
        after: {
            all: [],
        },
        error: {
            all: [
                async (context) => {
                    console.error(`Error in participant service on method ${context.method}:`, context.error);
                    return context;
                },
            ],
        },
    });
}
