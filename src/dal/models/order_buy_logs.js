const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class OrderBuyLogs extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      contract_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      token_id: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      tx: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      create_time: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
    }, {
      sequelize,
      tableName: 'order_buy_logs',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "id" },
          ]
        },
        {
          name: "contract_address",
          using: "BTREE",
          fields: [
            { name: "user_id" },
            { name: "contract_address" },
            { name: "order_id" },
          ]
        },
      ]
    });
  }
}
