import { Sequelize } from 'sequelize'
import initModels from './models/init-models.js'
import dotenv from 'dotenv'

dotenv.config()
const DB_HOST = process.env.DB_HOST
const DB_PORT = process.env.DB_PORT
const DB_NAME = process.env.DB_NAME
const DB_USER = process.env.DB_USER
const DB_PASS = process.env.DB_PASS

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
})

try {
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  console.error('Unable to connect to the database:', error);
}

// todo:
// https://github.com/sequelize/sequelize-auto/blob/c515542cf00f0cb4167327765b9f8cf67893a39a/src/auto-generator.ts#L382
// 生成 current_timestamp(6) 出错
export const {
  Contracts,
  OpenseaCollections,
  OpenseaItems,
  Orders,
  Tokens,
  Transactions,
} = initModels(sequelize)