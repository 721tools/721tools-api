import _sequelize from "sequelize";
const DataTypes = _sequelize.DataTypes;
import _Contracts from  "./contracts.js";
import _OpenseaCollections from  "./opensea_collections.js";
import _OpenseaItems from  "./opensea_items.js";
import _Orders from  "./orders.js";
import _Tokens from  "./tokens.js";
import _Transactions from  "./transactions.js";

export default function initModels(sequelize) {
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
