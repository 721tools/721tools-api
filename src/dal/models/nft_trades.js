const _sequelize = require("sequelize");
const { Model } = _sequelize;

module.exports = class NFTTrades extends Model {
  static init(sequelize, DataTypes) {
    const model = super.init({
      height: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      tx_hash: {
        type: DataTypes.STRING(66),
        allowNull: false,
        defaultValue: "",
        primaryKey: true,
      },
      logIndex: {
        type: DataTypes.INTEGER,
      },
      plateform: {
        type: DataTypes.TINYINT,
      },
      isBundle: {
        type: DataTypes.TINYINT,
      },
      address: {
        type: DataTypes.STRING(42),
        allowNull: false,
        defaultValue: ""
      },
      tokenId: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      amount: {
        type: DataTypes.INTEGER,
      },
      buyer: {
        type: DataTypes.STRING(42),
        allowNull: false,
        defaultValue: ""
      },
      seller: {
        type: DataTypes.STRING(42),
        allowNull: false,
        defaultValue: ""
      },
      priceETH: {
        type: DataTypes.DECIMAL(16, 8),
        allowNull: false,
        defaultValue: 0.0000
      },
      direction: {
        type: DataTypes.TINYINT,
      },
    }, {
      sequelize,
      tableName: 'nft_trades',
      timestamps: false,
    });
    model.removeAttribute("id");
    return model;
  };
}