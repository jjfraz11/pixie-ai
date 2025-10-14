const feathers = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');

const app = express(feathers());

// Parse HTTP JSON bodies
app.use(express.json());
// Parse URL-encoded params
app.use(express.urlencoded({ extended: true }));
// Host static files from the /public folder
app.use(express.static(__dirname + '/public'));
// Add REST API support
app.configure(express.rest());
// Configure Socket.io real-time APIs
app.configure(socketio());

// A basic error handler
app.use(express.errorHandler());

const usersService = require('./services/users/users.service');
const authentication = require('./authentication');

// Add any new services here
app.configure(authentication);
app.use('/users', usersService);

module.exports = app;
