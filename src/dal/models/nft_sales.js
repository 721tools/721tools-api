const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class NFTSales extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      height: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      tx_hash: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      // FIXME: typo from db
      plateform: {
        type: DataTypes.STRING.BINARY,
      },
      from: {
        type: DataTypes.STRING.BINARY,
      },
      to: {
        type: DataTypes.STRING.BINARY,
      },
      offer_item_type: {
        type: DataTypes.TINYINT,
      },
      offer_token: {
        type: "VARBINARY(32)",
      },
      offer_identifier: {
        type: "VARBINARY(32)",
      },
      offer_amount: {
        type: "VARBINARY(32)",
      },
      fulfiller_item_type: {
        type: DataTypes.TINYINT,
      },
      fulfiller_token: {
        type: "VARBINARY(32)",
      },
      fulfiller_identifier: {
        type: "VARBINARY(32)",
      },
      fulfiller_amount: {
        type: "VARBINARY(32)",
      },
      direction: {
        type: DataTypes.TINYINT,
      },
    }, {
      sequelize,
      tableName: 'nft_sales',
      timestamps: false,
    });
  }
}
