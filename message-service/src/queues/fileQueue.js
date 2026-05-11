const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const fileQueue = new Queue('file-processing', { connection });

module.exports = { fileQueue, connection };
