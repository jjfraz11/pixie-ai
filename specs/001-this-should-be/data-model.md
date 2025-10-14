# Data Model

## Entities

### User
*   **id**: String (Unique identifier)
*   **email**: String (Unique, used for login)
*   **password**: String (Hashed)
*   **roles**: String[] (e.g., "user", "broadcaster", "admin")
*   **createdAt**: DateTime
*   **updatedAt**: DateTime
*   **sessions**: Session[] (Relationship: User can host multiple Sessions)

### Session
*   **sessionId**: String (Unique identifier for the communication session)
*   **type**: Enum (p2p, broadcast)
*   **accessType**: Enum (public, private)
*   **password**: String (Optional, for private sessions, hashed)
*   **hostId**: String (Foreign key to User.id)
*   **host**: User (Relationship: Session is hosted by one User)
*   **participants**: Participant[] (List of active participants in the session)
*   **createdAt**: DateTime

### Participant
*   **participantId**: String (Unique identifier for the user in the session)
*   **name**: String (Display name for the user)
*   **role**: Enum (host, guest, broadcaster, viewer)

## Relationships

*   **User to Session**: One-to-Many (One User can host many Sessions)
*   **Session to User**: Many-to-One (Many Sessions can be hosted by one User)

## Validation Rules

### User Password
*   Minimum length: 6 characters
*   Complexity: At least one uppercase letter, one lowercase letter, one number, and one special character.