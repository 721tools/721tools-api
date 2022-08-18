const _sequelize = require("sequelize");

const DataTypes = _sequelize.DataTypes;
const _OpenseaCollections = require('./opensea_collections.js');
const _OpenseaItems = require('./opensea_items.js');
const _Orders = require('./orders.js');
const _SmartBuys = require('./smart_buys.js');
const _User = require('./user.js');



const initModels = (sequelize, assetsSequelize) => {
  const OpenseaCollections = _OpenseaCollections.init(assetsSequelize, DataTypes);
  const OpenseaItems = _OpenseaItems.init(assetsSequelize, DataTypes);
  const Orders = _Orders.init(assetsSequelize, DataTypes);
  const SmartBuys = _SmartBuys.init(sequelize, DataTypes);
  const User = _User.init(sequelize, DataTypes);


  return {
    OpenseaCollections,
    OpenseaItems,
    Orders,
    SmartBuys,
    User,
  };
}

module.exports = initModels;