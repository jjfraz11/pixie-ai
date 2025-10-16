import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import { BadRequest } from '@feathersjs/errors';
import { hooks } from '@feathersjs/authentication-local';
import configurePasswordResetService from './password-reset.service';
export default function configureAuthenticationService(app) {
    console.log('Authentication entity setting:', app.get('authentication').entity); // Log entity setting
    const authentication = new AuthenticationService(app);
    authentication.register('jwt', new JWTStrategy());
    authentication.register('local', new LocalStrategy());
    app.use('/authentication', authentication);
    // Configure password reset service as part of authentication
    configurePasswordResetService(app);
    // CAPTCHA integration placeholder
    // In a production environment, integrate with Google reCAPTCHA or similar
    // For now, rate limiting provides basic brute-force protection
    // CAPTCHA integration for brute-force protection
    // Note: In a real application, integrate with a CAPTCHA service like reCAPTCHA
    // For now, we'll rely on rate limiting implemented in app.ts
    // Add hooks to the authentication service
    app.service('authentication').hooks({
        before: {
            create: [
                hooks.hashPassword('password'),
                async (context) => {
                    if (context.data.strategy === 'local') {
                        if (context.data.captcha !== 'pixie') {
                            throw new BadRequest('Invalid CAPTCHA');
                        }
                    }
                    // Log authentication attempts for debugging
                    console.log('Authentication attempt:', {
                        strategy: context.data?.strategy,
                        email: context.data?.email,
                    });
                    return context;
                },
            ],
        },
        error: {
            all: [
                async (context) => {
                    console.error(`Error in authentication service on method ${context.method}:`, context.error);
                    return context;
                },
            ],
        },
    });
    return authentication;
}
