const Sequelize = require('sequelize');
import sequelize from "../db";

const Collection = sequelize.define("collection", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    description: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    contract_address: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    chain: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    start_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    total_supply: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    current_supply: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    total_revealed: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    image_url: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    tokens: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    traits: {
        type: Sequelize.STRING,
        allowNull: false,
    },
}, {
    timestamps: false,
    createdAt: "create_time",
    updatedAt: "update_time",
    freezeTableName: true
});

export default Collection;