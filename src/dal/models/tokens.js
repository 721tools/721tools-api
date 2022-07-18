const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class Tokens extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      token_address: {
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
      tableName: 'tokens',
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
            { name: "token_address" },
          ]
        },
      ]
    });
  }
}