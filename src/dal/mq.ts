import { createClient } from 'redis';

require('../config/env');

const redis = createClient({
    url: process.env.REDIS_URL
});
redis.on('error', (err) => console.log('Redis Client Error', err));

export {
    redis
}