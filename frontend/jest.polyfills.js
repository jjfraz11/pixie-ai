const { TextEncoder, TextDecoder } = require("util");

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.Request = require("node-fetch").Request;
global.Response = require("node-fetch").Response;
