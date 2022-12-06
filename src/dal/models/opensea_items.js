const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class OpenseaItems extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      token_id: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      asset_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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
      name: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      owner_address: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
      image_url: {
        type: DataTypes.STRING(256),
        allowNull: false,
        defaultValue: ""
      },
      image_original_url: {
        type: DataTypes.STRING(128),
        allowNull: false,
        defaultValue: ""
      },
      traits: {
        type: DataTypes.JSON,
        allowNull: true
      },
      traits_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      traits_rank: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      supports_wyvern: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
      tableName: 'opensea_items',
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
            { name: "token_id" },
          ]
        },
      ]
    });
  }
}
