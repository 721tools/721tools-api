const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class Orders extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      collection_name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      collection_description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      collection_slug: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      contract_address: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      token_id: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      owner_address: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      from: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      type: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      price: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      trait_type: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      trait_name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      order_created_date: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
      order_expiration_date: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
      order_event_timestamp: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
      order_sent_at: {
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
      tableName: 'orders',
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
            { name: "token_address" },
            { name: "type" },
          ]
        },
      ]
    });
  }
}