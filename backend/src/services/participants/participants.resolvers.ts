import { resolve } from '@feathersjs/schema';
import { Type } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';
import type { HookContext } from '@feathersjs/feathers';

export const participantSchema = Type.Object({
  id: Type.Optional(Type.String()),
  sessionId: Type.String(),
  session: Type.Optional(Type.Any()), // Will be resolved separately
  userId: Type.Optional(Type.String()),
  user: Type.Optional(Type.Any()), // Will be resolved separately
  participantIdentity: Type.String(),
  displayName: Type.String({ maxLength: 50 }),
  role: Type.Enum({ HOST: 'HOST', GUEST: 'GUEST', BROADCASTER: 'BROADCASTER', VIEWER: 'VIEWER' }),
  status: Type.Optional(
    Type.Enum({
      CONNECTING: 'CONNECTING',
      CONNECTED: 'CONNECTED',
      DISCONNECTED: 'DISCONNECTED',
      RECONNECTING: 'RECONNECTING',
    }),
  ),
  permissions: Type.Optional(Type.Array(Type.String())),
  joinedAt: Type.Optional(Type.String({ format: 'date-time' })),
  leftAt: Type.Optional(Type.String({ format: 'date-time' })),
  lastActivityAt: Type.Optional(Type.String({ format: 'date-time' })),
  isAudioEnabled: Type.Optional(Type.Boolean()),
  isVideoEnabled: Type.Optional(Type.Boolean()),
  isScreenShareEnabled: Type.Optional(Type.Boolean()),
  connectionQuality: Type.Optional(
    Type.Enum({ EXCELLENT: 'EXCELLENT', GOOD: 'GOOD', POOR: 'POOR', TERRIBLE: 'TERRIBLE' }),
  ),
  deviceInfo: Type.Optional(Type.Any()),
  ipAddress: Type.Optional(Type.String()),
});

export type Participant = Static<typeof participantSchema>;

export const participantDataSchema = Type.Pick(participantSchema, [
  'sessionId',
  'userId',
  'participantIdentity',
  'displayName',
  'role',
  'permissions',
  'isAudioEnabled',
  'isVideoEnabled',
  'isScreenShareEnabled',
  'deviceInfo',
  'ipAddress',
]);

export type ParticipantData = Static<typeof participantDataSchema>;

export const participantPatchSchema = Type.Partial(participantDataSchema);

export type ParticipantPatch = Static<typeof participantPatchSchema>;

export const participantDataResolver = resolve<Participant, HookContext>({
  properties: {},
});

export const participantExternalResolver = resolve<Participant, HookContext>({
  properties: {},
});
