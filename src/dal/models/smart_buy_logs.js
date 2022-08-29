const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class SmartBuyLogs extends Model {
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
      type: {
        type: DataTypes.STRING(16),
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
      tableName: 'smart_buy_logs',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "id" },
          ]
        }
      ]
    });
  }
}
