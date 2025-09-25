import {
    createClient
} from "redis";
import "dotenv/config"

const client = createClient({
    /* username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD, */
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

client.connect()
    .then(() => console.log("Connected to Redis successfully."))
    .catch(err => console.error)

export {
    client
}