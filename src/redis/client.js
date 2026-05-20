const Redis = require('ioredis');

const pub = new Redis(process.env.REDIS_URL);
const sub = new Redis(process.env.REDIS_URL);

module.exports = { pub, sub };