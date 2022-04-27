const Sequelize = require("sequelize");

console.log('init sequelize...');

const database = process.env.DB_DATABASE || "721tools";
const username = process.env.DB_USERNAME || "root";
const password = process.env.DB_PASSWORD || "";
const host = process.env.DB_HOST || "127.0.0.1";
const port = process.env.DB_PORT || 3306;

const sequelize = new Sequelize(database, username, password, {
    host: host,
    port: port,
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 10000,
    },
    logging: true,
})

export default sequelize;