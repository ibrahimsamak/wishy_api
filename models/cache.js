const redis = require('redis');
const host = 'redis-11505.c99.us-east-1-4.ec2.cloud.redislabs.com'
const port = 11505
const password = 'gazredis'
const client = redis.createClient({
    port: port, host: host, password: password
})


exports.client = client;