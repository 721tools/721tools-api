const _sequelize = require("sequelize");

const DataTypes = _sequelize.DataTypes;
const _Contracts = require('./contracts.js');
const _OpenseaCollections = require('./opensea_collections.js');
const _OpenseaItems = require('./opensea_items.js');
const _Orders = require('./orders.js');
const _Tokens = require('./tokens.js');
const _Transactions = require('./transactions.js');


const initModels = (sequelize) => {
  const Contracts = _Contracts.init(sequelize, DataTypes);
  const OpenseaCollections = _OpenseaCollections.init(sequelize, DataTypes);
  const OpenseaItems = _OpenseaItems.init(sequelize, DataTypes);
  const Orders = _Orders.init(sequelize, DataTypes);
  const Tokens = _Tokens.init(sequelize, DataTypes);
  const Transactions = _Transactions.init(sequelize, DataTypes);


  return {
    Contracts,
    OpenseaCollections,
    OpenseaItems,
    Orders,
    Tokens,
    Transactions,
  };
}

module.exports = initModels;