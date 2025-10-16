import prisma from '@/prisma';
import { hooks } from '@feathersjs/authentication-local';
import { GeneralError, NotFound, BadRequest, Conflict, Forbidden } from '@feathersjs/errors'; // Import FeathersJS errors
import { authenticate } from '@feathersjs/authentication'; // Import authenticate hook
import { validatePasswordStrength } from '@/services/authentication/utils/password-validation';
class UserService {
    constructor(options, app) {
        this.options = options;
        this.app = app;
    }
    async find(params) {
        try {
            const { $limit, email } = params?.query || {};
            return prisma.user.findMany({ take: $limit, where: { email } });
        }
        catch (error) {
            throw new GeneralError('Failed to retrieve users', error);
        }
    }
    async get(id, params) {
        try {
            const user = await prisma.user.findUnique({
                where: { id },
                ...params?.query,
            });
            if (!user) {
                throw new NotFound(`User with id '${id}' not found`);
            }
            return user;
        }
        catch (error) {
            if (error instanceof NotFound) {
                throw error;
            }
            throw new GeneralError(`Failed to retrieve user with id '${id}'`, error);
        }
    }
    async create(data, params) {
        try {
            return prisma.user.create({ data });
        }
        catch (error) {
            if (error.code === 'P2002') {
                // Prisma unique constraint violation
                throw new Conflict('User with this email already exists');
            }
            throw new GeneralError('Failed to create user', error);
        }
    }
    async update(id, data, params) {
        try {
            return prisma.user.update({ where: { id: id }, data });
        }
        catch (error) {
            if (error.code === 'P2025') {
                // Prisma record not found
                throw new NotFound(`User with id '${id}' not found`);
            }
            if (error.code === 'P2002') {
                // Prisma unique constraint violation
                throw new Conflict('User with this email already exists');
            }
            throw new GeneralError(`Failed to update user with id '${id}'`, error);
        }
    }
    async patch(id, data, params) {
        try {
            return prisma.user.update({ where: { id: id }, data });
        }
        catch (error) {
            if (error.code === 'P2025') {
                // Prisma record not found
                throw new NotFound(`User with id '${id}' not found`);
            }
            if (error.code === 'P2002') {
                // Prisma unique constraint violation
                throw new Conflict('User with this email already exists');
            }
            throw new GeneralError(`Failed to patch user with id '${id}'`, error);
        }
    }
    async remove(id, params) {
        try {
            return prisma.user.delete({ where: { id: id } });
        }
        catch (error) {
            if (error.code === 'P2025') {
                // Prisma record not found
                throw new NotFound(`User with id '${id}' not found`);
            }
            throw new GeneralError(`Failed to remove user with id '${id}'`, error);
        }
    }
}
export default function configureUsersService(app) {
    const options = {
        paginate: app.get('paginate'),
    };
    app.use('/users', new UserService(options, app));
    const service = app.service('users');
    service.hooks({
        before: {
            all: [], // Authenticate all methods by default
            find: [],
            get: [],
            create: [
                async (context) => {
                    if (context.data.captcha !== 'pixie') {
                        throw new BadRequest('Invalid CAPTCHA');
                    }
                    if (context.data.password) {
                        const passwordValidation = validatePasswordStrength(context.data.password);
                        if (!passwordValidation.isValid) {
                            throw new BadRequest(passwordValidation.errors.join(', '));
                        }
                    }
                    return context;
                },
                hooks.hashPassword('password'),
            ],
            update: [
                authenticate('jwt'), // Authenticate update operations
                async (context) => {
                    if (context.data.roles && (!context.params.user || !context.params.user.roles.includes('admin'))) {
                        throw new Forbidden('Only administrators can update user roles.');
                    }
                    if (context.data.password) {
                        const passwordValidation = validatePasswordStrength(context.data.password);
                        if (!passwordValidation.isValid) {
                            throw new BadRequest(passwordValidation.errors.join(', '));
                        }
                    }
                    return context;
                },
            ],
            patch: [
                authenticate('jwt'), // Authenticate patch operations
                async (context) => {
                    if (context.data.roles && (!context.params.user || !context.params.user.roles.includes('admin'))) {
                        throw new Forbidden('Only administrators can update user roles.');
                    }
                    if (context.data.password) {
                        const passwordValidation = validatePasswordStrength(context.data.password);
                        if (!passwordValidation.isValid) {
                            throw new BadRequest(passwordValidation.errors.join(', '));
                        }
                    }
                    return context;
                },
            ],
            remove: [authenticate('jwt')], // Authenticate remove operations
        },
        after: {
            all: [
                async (context) => {
                    if (context.result && context.result.password) {
                        delete context.result.password;
                    }
                    return context;
                },
            ],
        },
    });
}
