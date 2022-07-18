import _sequelize from 'sequelize';
const { Model, Sequelize } = _sequelize;

export default class Transactions extends Model {
  static init(sequelize, DataTypes) {
  return super.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    tx: {
      type: DataTypes.STRING(128),
      allowNull: false,
      defaultValue: "",
      unique: "tx_2"
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
    from_address: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: ""
    },
    calldata: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    value: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "0"
    },
    gas_price: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "0"
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
    tableName: 'transactions',
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
        name: "tx",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "tx" },
        ]
      },
      {
        name: "tx_2",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "tx" },
        ]
      },
    ]
  });
  }
}
