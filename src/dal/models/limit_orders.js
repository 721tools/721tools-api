const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class LimitOrders extends Model {
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
      slug: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      contract_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      purchased: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      price: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0
      },
      traits: {
        type: DataTypes.JSON,
        allowNull: true
      },
      skip_flagged: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: ""
      },
      error_code: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      error_details: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      expiration_time: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
      create_time: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
      update_time: {
        type: DataTypes.DATE(6),
        allowNull: true,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      }
    }, {
      sequelize,
      tableName: 'limit_orders',
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
            { name: "contract_address" },
            { name: "status" },
            { name: "user_id" },
          ]
        },
      ]
    });
  }
}