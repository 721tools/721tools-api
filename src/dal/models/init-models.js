const _sequelize = require("sequelize");

const DataTypes = _sequelize.DataTypes;
const _OpenseaCollections = require('./opensea_collections.js');
const _OpenseaItems = require('./opensea_items.js');
const _Orders = require('./orders.js');
const _User = require('./user.js');
const _SmartBuys = require('./smart_buys.js');
const _SmartBuyLogs = require('./smart_buy_logs.js');



const initModels = (sequelize, assetsSequelize) => {
  const OpenseaCollections = _OpenseaCollections.init(assetsSequelize, DataTypes);
  const OpenseaItems = _OpenseaItems.init(assetsSequelize, DataTypes);
  const Orders = _Orders.init(assetsSequelize, DataTypes);
  const User = _User.init(sequelize, DataTypes);
  const SmartBuys = _SmartBuys.init(sequelize, DataTypes);
  const SmartBuyLogs = _SmartBuyLogs.init(sequelize, DataTypes);


  return {
    OpenseaCollections,
    OpenseaItems,
    Orders,
    User,
    SmartBuys,
    SmartBuyLogs,
  };
}

module.exports = initModels;