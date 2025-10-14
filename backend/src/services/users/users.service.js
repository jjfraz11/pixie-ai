const { service } = require('feathers-prisma');
const prisma = require('../../prisma');
const { hooks } = require('@feathersjs/authentication-local');

const usersService = service({
  model: 'User',
  prisma,
});

const before = {
  all: [],
  find: [],
  get: [],
  create: [hooks.hashPassword('password')],
  update: [hooks.hashPassword('password')],
  patch: [hooks.hashPassword('password')],
  remove: []
};

usersService.hooks({ before });

module.exports = usersService;
