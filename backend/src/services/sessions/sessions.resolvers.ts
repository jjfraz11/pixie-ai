import { resolve } from '@feathersjs/schema';
import { Type } from '@feathersjs/typebox';
import type { Static } from '@feathersjs/typebox';
import type { HookContext } from '@feathersjs/feathers';

export const sessionSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.Enum({ P2P: 'P2P', BROADCAST: 'BROADCAST' }),
  accessType: Type.Optional(Type.Enum({ PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE' })),
  password: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  title: Type.String({ maxLength: 100 }),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  status: Type.Optional(Type.Enum({ INITIALIZING: 'INITIALIZING', ACTIVE: 'ACTIVE', ENDED: 'ENDED', ERROR: 'ERROR' })),
  maxParticipants: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
  currentParticipants: Type.Optional(Type.Integer({ minimum: 0 })),
  hostId: Type.String(),
  participants: Type.Optional(Type.Array(Type.Any())), // Will be resolved separately
  settings: Type.Optional(Type.Union([Type.Any(), Type.Null()])),
  liveKitRoomId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  startedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  endedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type Session = Static<typeof sessionSchema>;

export const sessionDataSchema = Type.Pick(sessionSchema, [
  'type',
  'accessType',
  'password',
  'title',
  'description',
  'maxParticipants',
  'hostId',
  'settings',
]);

export type SessionData = Static<typeof sessionDataSchema>;

export const sessionPatchSchema = Type.Partial(Type.Omit(sessionDataSchema, ['hostId']));

export type SessionPatch = Static<typeof sessionPatchSchema>;

export const sessionDataResolver = resolve<Session, HookContext>({
  properties: {},
});

export const sessionExternalResolver = resolve<Session, HookContext>({
  properties: {},
});
