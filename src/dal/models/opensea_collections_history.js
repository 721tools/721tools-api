const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class OpenseaCollectionsHistory extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      slug: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      contract_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      total_supply: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      current_supply: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_revealed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      taker_relayer_fee: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 750
      },
      num_owners: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      total_sales: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      thirty_day_sales: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      seven_day_sales: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      one_day_sales: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      one_day_volume: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      thirty_day_volume: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      seven_day_volume: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      total_volume: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      market_cap: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      floor_price: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
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
      tableName: 'opensea_collections_history',
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
          unique: false,
          using: "BTREE",
          fields: [
            { name: "contract_address" },
          ]
        },
        {
          name: "slug",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "slug" },
          ]
        },
      ]
    });
  }
}
