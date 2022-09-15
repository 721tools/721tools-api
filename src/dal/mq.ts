import { createClient } from 'redis';

require('../config/env');

const redis_host = process.env.MQ_REDIS_HOST;
const redis_port = process.env.MQ_REDIS_PORT;
const redis = createClient({
    url: `redis://${redis_host}:${redis_port}`
});
redis.on('error', (err) => console.log('Redis Client Error', err));

export {
    redis
}