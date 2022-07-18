import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class Contracts extends Model {
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
    contract_address: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "",
      unique: "contract_address"
    },
    creator_address: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: ""
    },
    created_at_block_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    created_at_tx: {
      type: DataTypes.STRING(128),
      allowNull: false,
      defaultValue: ""
    },
    is_open_source: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0
    },
    code: {
      type: DataTypes.TEXT,
      allowNull: false
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
    tableName: 'contracts',
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
    ]
  });
  }
}
