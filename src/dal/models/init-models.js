const _sequelize = require("sequelize");

const DataTypes = _sequelize.DataTypes;
const _Contracts = require('./contracts.js');
const _OpenseaCollections = require('./opensea_collections.js');
const _OpenseaItems = require('./opensea_items.js');
const _Orders = require('./orders.js');
const _Tokens = require('./tokens.js');
const _Transactions = require('./transactions.js');
const _SmartBuys = require('./smart_buys.js');
const _User = require('./user.js');



const initModels = (sequelize, assetsSequelize) => {
  const Contracts = _Contracts.init(assetsSequelize, DataTypes);
  const OpenseaCollections = _OpenseaCollections.init(assetsSequelize, DataTypes);
  const OpenseaItems = _OpenseaItems.init(assetsSequelize, DataTypes);
  const Orders = _Orders.init(assetsSequelize, DataTypes);
  const Tokens = _Tokens.init(assetsSequelize, DataTypes);
  const Transactions = _Transactions.init(assetsSequelize, DataTypes);
  const SmartBuys = _SmartBuys.init(sequelize, DataTypes);
  const User = _User.init(sequelize, DataTypes);


  return {
    Contracts,
    OpenseaCollections,
    OpenseaItems,
    Orders,
    Tokens,
    Transactions,
    SmartBuys,
    User,
  };
}

module.exports = initModels;