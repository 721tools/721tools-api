const Sequelize = require('sequelize');
const initModels = require('./models/init-models');
require('../config/env');

const ASSETS_DB_HOST = process.env.ASSETS_DB_HOST
const ASSETS_DB_PORT = process.env.ASSETS_DB_PORT
const ASSETS_DB_NAME = process.env.ASSETS_DB_NAME
const ASSETS_DB_USER = process.env.ASSETS_DB_USER
const ASSETS_DB_PASS = process.env.ASSETS_DB_PASS

const DB_HOST = process.env.DB_HOST
const DB_PORT = process.env.DB_PORT
const DB_NAME = process.env.DB_NAME
const DB_USER = process.env.DB_USER
const DB_PASS = process.env.DB_PASS


const assetsSequelize = new Sequelize(ASSETS_DB_NAME, ASSETS_DB_USER, ASSETS_DB_PASS, {
  host: ASSETS_DB_HOST,
  port: ASSETS_DB_PORT,
  dialect: 'mysql',
  logging: false,
})

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
})

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
  User,
  SmartBuys,
  SmartBuyLogs,
  Whitelist,
  NFTSales,
} = initModels(sequelize, assetsSequelize)