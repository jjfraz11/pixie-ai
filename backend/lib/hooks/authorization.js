import { Forbidden } from "@feathersjs/errors";
// Custom authorization hook for RBAC
export const authorize = (requiredRoles = []) => {
    return async (context) => {
        const { user } = context.params;
        if (!user) {
            throw new Forbidden("Authentication required");
        }
        // If no specific roles required, just need authentication
        if (requiredRoles.length === 0) {
            return context;
        }
        // Check if user has any of the required roles
        const hasRequiredRole = requiredRoles.some((role) => user.roles?.includes(role));
        if (!hasRequiredRole) {
            throw new Forbidden(`Insufficient permissions. Required roles: ${requiredRoles.join(", ")}`);
        }
        return context;
    };
};
