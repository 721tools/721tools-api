const _sequelize = require("sequelize");

const DataTypes = _sequelize.DataTypes;
const _OpenseaCollections = require('./opensea_collections.js');
const _OpenseaCollectionsHistory = require('./opensea_collections_history.js');

const _OpenseaItems = require('./opensea_items.js');

const _Orders = require('./orders.js');
const _User = require('./user.js');
const _SmartBuys = require('./smart_buys.js');
const _SmartBuyLogs = require('./smart_buy_logs.js');
const _Whitelist = require('./whitelist.js');
const _NFTTrades = require('./nft_trades.js')
const _LimitOrders = require('./limit_orders.js');
const _OrderBuyLogs = require('./order_buy_logs.js');
const _OrderFilleds = require('./order_filleds.js')


const initModels = (sequelize, assetsSequelize) => {
  const OpenseaCollections = _OpenseaCollections.init(assetsSequelize, DataTypes);
  const OpenseaCollectionsHistory = _OpenseaCollectionsHistory.init(assetsSequelize, DataTypes);
  const OpenseaItems = _OpenseaItems.init(assetsSequelize, DataTypes);
  const Orders = _Orders.init(assetsSequelize, DataTypes);
  const NFTTrades = _NFTTrades.init(assetsSequelize, DataTypes);
  const OrderFilleds = _OrderFilleds.init(assetsSequelize, DataTypes);
  const User = _User.init(sequelize, DataTypes);
  const SmartBuys = _SmartBuys.init(sequelize, DataTypes);
  const SmartBuyLogs = _SmartBuyLogs.init(sequelize, DataTypes);
  const Whitelist = _Whitelist.init(sequelize, DataTypes);
  const LimitOrders = _LimitOrders.init(sequelize, DataTypes);
  const OrderBuyLogs = _OrderBuyLogs.init(sequelize, DataTypes);


  return {
    OpenseaCollections,
    OpenseaCollectionsHistory,
    OpenseaItems,
    Orders,
    User,
    SmartBuys,
    SmartBuyLogs,
    Whitelist,
    NFTTrades,
    LimitOrders,
    OrderBuyLogs,
    OrderFilleds,
  };
}

module.exports = initModels;