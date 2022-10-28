const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class Whitelist extends Model {
  static init(sequelize, DataTypes) {
    return super.init({
      id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      owner: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: ""
      },
      remark: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ""
      },
      create_time: {
        type: DataTypes.DATE(6),
        allowNull: false,
        defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP(6)')
      },
    }, {
      sequelize,
      tableName: 'whitelist',
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
          name: "address",
          unique: true,
          fields: [
            { name: "contract_address" },
          ]
        },
      ]
    });
  }
}
