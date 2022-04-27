const Sequelize = require('sequelize');
import sequelize from "../db";

const collection = sequelize.define("collection", {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
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
    banner_image_url: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    not_revealed_image: {
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

export default collection;