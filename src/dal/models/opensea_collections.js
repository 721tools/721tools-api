const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class OpenseaCollections extends Model {
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
      schema: {
        type: DataTypes.STRING(16),
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
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      from_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      end_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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
      banner_image_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      image_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      etherscan_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      external_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      wiki_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      discord_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      twitter_username: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      instagram_username: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
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
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      thirty_day_volume: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      seven_day_volume: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      total_volume: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      market_cap: {
        type: DataTypes.DECIMAL(12, 4),
        allowNull: false,
        defaultValue: 0.0000
      },
      floor_price: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      created_date: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      token: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      traits: {
        type: DataTypes.JSON,
        allowNull: true
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
      tableName: 'opensea_collections',
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
          unique: true,
          using: "BTREE",
          fields: [
            { name: "contract_address" },
            { name: "token" },
          ]
        },
      ]
    });
  }
}
