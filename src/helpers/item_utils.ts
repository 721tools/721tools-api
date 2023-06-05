import _ from 'lodash';
import Sequelize from 'sequelize';

import { OpenseaCollections, OpenseaItems } from '../dal/db';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";

export const setItemInfo = async (items, collection) => {
    if (items && items.length > 0) {
        const selectTokens = [];
        const isStringTokenId = typeof items[0].token_id === "string" || typeof items[0].token_id === "number";
        for (const item of items) {
            if (isStringTokenId) {
                selectTokens.push(parseTokenId(item.token_id));
            } else {
                selectTokens.push(item.token_id);
            }
        }
        const itemsRes = await OpenseaItems.findAll({
            where: {
                contract_address: collection.contract_address,
                token_id: selectTokens
            }
        });

        const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => [parseInt(item.token_id.toString("hex"), 16).toString(), item.dataValues]));
        for (let index in items) {
            const nft = items[index];
            const tokenId = isStringTokenId ? nft.token_id.toString() : parseInt(nft.token_id.toString("hex"), 16).toString();
            if (itemMap.has(tokenId)) {
                const item = itemMap.get(tokenId);
                nft.rank = item.traits_rank;
                nft.image = item.image_url;
                if (!nft.image) {
                    nft.image = item.image_original_url;
                }
                if (!nft.image) {
                    nft.image = collection.image_url;
                }
                nft.name = item.name;
                nft.supports_wyvern = item.supports_wyvern;
            } else {
                nft.name = collection.name + " #" + tokenId;
                nft.image = collection.image_url;
                nft.rank = 0;
                nft.supports_wyvern = true;
            }
            items[index] = nft;
        }
    }
    return items;
};

export const setOrderItemInfo = async (orders, items, collection) => {
    let itemMap = new Map<string, typeof OpenseaItems>();
    if (items && items.length > 0) {
        itemMap = new Map<string, typeof OpenseaItems>(items.map((item) => [parseInt(item.token_id.toString("hex"), 16).toString(), item.dataValues]));
    }
    for (let index in orders) {
        const nft = orders[index];
        const tokenId = parseInt(nft.token_id.toString("hex"), 16).toString();
        if (itemMap.has(tokenId)) {
            const item = itemMap.get(tokenId);
            nft.rank = item.traits_rank;
            nft.image = item.image_url;
            nft.name = item.name;
            nft.supports_wyvern = item.supports_wyvern;
        } else {
            nft.name = collection.name + " #" + tokenId;
            nft.image = collection.image_url;
            nft.rank = 0;
            nft.supports_wyvern = true;
        }
        orders[index] = nft;
    }
    return orders;
};

export const setNftTradesItemInfo = async (orders, items, collection) => {
    let itemMap = new Map<string, typeof OpenseaItems>();
    if (items && items.length > 0) {
        itemMap = new Map<string, typeof OpenseaItems>(items.map((item) => [parseInt(item.token_id.toString("hex"), 16).toString(), item.dataValues]));
    }
    for (let index in orders) {
        const nft = orders[index];
        const tokenId = nft.token_id.toString();
        if (itemMap.has(tokenId)) {
            const item = itemMap.get(tokenId);
            nft.rank = item.traits_rank;
            nft.image = item.image_url;
            nft.name = item.name;
            nft.supports_wyvern = item.supports_wyvern;
        } else {
            nft.name = collection.name + " #" + tokenId;
            nft.image = collection.image_url;
            nft.rank = 0;
            nft.supports_wyvern = true;
        }
        orders[index] = nft;
    }
    return orders;
};

export const getItemsByTraitsAndSkipFlagged = async (collection, traits, skipFlagged) => {
    const where = {
        contract_address: collection.contract_address,
    };
    if (skipFlagged) {
        where['supports_wyvern'] = true;
    }
    const items = await OpenseaItems.findAll({
        where: where
    });
    if (items.length == 0) {
        return items;
    }
    if (_.isEmpty(traits)) {
        return items;
    }
    const result = [];
    for (const item of items) {
        if (traitsMatched(item.traits, traits)) {
            result.push(item);
        }
    }
    return result;
}

export const traitsMatched = (itemTraits, targetTraits) => {
    if (_.isEmpty(itemTraits)) {
        return false;
    }
    if (_.isEmpty(targetTraits)) {
        return true;
    }
    const traitsMap = _.groupBy(itemTraits, function (item) {
        return item.trait_type;
    });

    let allContains = true;
    for (const traitType of Object.keys(targetTraits)) {
        let traitContains = false;
        if (traitType in traitsMap) {
            const traitValues = traitsMap[traitType].map(trait => {
                return trait.value.toLowerCase();
            });
            for (const traitValue of targetTraits[traitType]) {
                if (traitValues.includes(traitValue)) {
                    traitContains = true;
                    break;
                }
            }
        }
        if (!traitContains) {
            allContains = false;
            break;
        }
    }
    if (allContains) {
        return true;
    }
    return false;
}

export const setMultiCollectionItemInfo = async (items) => {
    const selectTokens = [];
    for (const item of items) {
        selectTokens.push({
            "contract_address": parseAddress(item.contract_address),
            "token_id": parseTokenId(item.token_id)
        });
    }
    const itemsRes = await OpenseaItems.findAll({ where: { [Sequelize.Op.or]: selectTokens } });
    const collectionsRes = await OpenseaCollections.findAll({
        where: {
            contract_address: itemsRes.map(item => item.contract_address)
        }
    });

    const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex') + "|" + parseInt(item.token_id.toString("hex"), 16), item.dataValues]));
    const collctionMap = new Map<string, typeof OpenseaCollections>(collectionsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex'), item.dataValues]));
    for (let index in items) {
        const item = items[index];
        if (itemMap.has(item.contract_address.toLowerCase() + "|" + item.token_id)) {
            const openseaItem = itemMap.get(item.contract_address.toLowerCase() + "|" + item.token_id);
            item.rank = openseaItem.traits_rank;
            item.image = openseaItem.image_url;
            item.name = openseaItem.name;
            item.supports_wyvern = openseaItem.supports_wyvern;
        } else {
            if (collctionMap.has(item.contract_address)) {
                const collection = collctionMap.get(item.contract_address.toLowerCase());
                item.name = collection.name + " #" + item.token_id;
                item.image = collection.image_url;
                item.rank = 0;
                item.supports_wyvern = true;
            }
        }
        items[index] = item;
    }
    return items;
};