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
      collection_id: {
        type: DataTypes.INTEGER,
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
      contract_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      contract_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      token_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      token_address: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      owner_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
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
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "0"
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
