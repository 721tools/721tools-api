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
      tx_hash_string: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: ""
      },
      plateform: {
        type: DataTypes.STRING.BINARY,
      },
      from: {
        type: DataTypes.STRING.BINARY,
      },
      from_string: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: ""
      },
      to: {
        type: DataTypes.STRING.BINARY,
      },
      to_string: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: ""
      },
      offer_item_type: {
        type: DataTypes.TINYINT,
      },
      offer_token: {
        type: "VARBINARY(32)",
      },
      offer_token_string: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      offer_identifier: {
        type: "VARBINARY(32)",
      },
      offer_identifier_string: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      offer_amount: {
        type: "VARBINARY(32)",
      },
      offer_amount_string: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      fulfiller_item_type: {
        type: DataTypes.TINYINT,
      },
      fulfiller_token: {
        type: "VARBINARY(32)",
      },
      fulfiller_token_string: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      fulfiller_identifier: {
        type: "VARBINARY(32)",
      },
      fulfiller_identifier_string: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      fulfiller_amount: {
        type: "VARBINARY(32)",
      },
      fulfiller_amount_string: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      direction: {
        type: DataTypes.TINYINT,
      },
      timestamp: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
      created_at: {
        type: DataTypes.DATE(6),
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
    }, {
      sequelize,
      tableName: 'nft_sales',
      timestamps: false,
    });
  }
}
