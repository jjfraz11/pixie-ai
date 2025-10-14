import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
export default (app) => {
    const authentication = new AuthenticationService(app);
    authentication.register('jwt', new JWTStrategy());
    authentication.register('local', new LocalStrategy());
    app.use('/authentication', authentication);
    // Add hooks to the authentication service
    app.service('authentication').hooks({
        before: {
            create: [
                async (context) => {
                    // Log authentication attempts for debugging
                    console.log('Authentication attempt:', {
                        strategy: context.data?.strategy,
                        email: context.data?.email
                    });
                    return context;
                }
            ]
        },
        error: {
            all: [
                async (context) => {
                    console.error(`Error in authentication service on method ${context.method}:`, context.error);
                    return context;
                }
            ]
        }
    });
    return authentication;
};
