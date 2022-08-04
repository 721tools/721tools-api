const _sequelize = require("sequelize");
const { Model, Sequelize } = _sequelize;

module.exports = class User extends Model {
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
      smart_address: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: ""
      },
      valid: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      type: {
        type: DataTypes.STRING(16),
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
      tableName: 'user',
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
      ]
    });
  }
}
