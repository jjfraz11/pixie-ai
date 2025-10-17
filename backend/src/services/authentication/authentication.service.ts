import { Application } from '@feathersjs/feathers';
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';

import configurePasswordResetService from './password-reset.service';
import { configureAuthenticationHooks } from './authentication.hooks';

export default function configureAuthenticationService(app: Application) {
  console.log('Authentication entity setting:', app.get('authentication').entity); // Log entity setting

  const authentication = new AuthenticationService(app);

  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new LocalStrategy());

  app.use('/authentication', authentication);

  // Configure password reset service as part of authentication
  configurePasswordResetService(app);

  // Configure hooks using the dedicated hooks file
  const service = app.service('authentication');
  configureAuthenticationHooks(service);

  return authentication;
}
