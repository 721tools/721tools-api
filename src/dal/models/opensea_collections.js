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
      contract_address: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
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
      created_date: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      traits: {
        type: DataTypes.JSON,
        allowNull: true
      },
      cursor: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
