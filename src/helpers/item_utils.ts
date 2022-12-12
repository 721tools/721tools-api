import _ from 'lodash';
import { OpenseaItems } from '../dal/db';
import { parseTokenId } from "../helpers/binary_utils";

export const setItemInfo = async (items, collection) => {
    if (items && items.length > 0) {
        const selectTokens = [];
        const isStringTokenId = typeof items[0].token_id === "string";
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
        if (itemsRes && itemsRes.length > 0) {
            const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => [parseInt(item.token_id.toString("hex"), 16).toString(), item.dataValues]));
            for (let index in items) {
                const nft = items[index];
                const tokenId = isStringTokenId ? nft.token_id : parseInt(nft.token_id.toString("hex"), 16).toString();
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
                items[index] = nft;
            }
        }
    }
    return items;
};

export const setOrderItemInfo = async (orders, items, collection) => {
    const itemMap = new Map<string, typeof OpenseaItems>(items.map((item) => [item.token_id, item.dataValues]));
    for (let index in orders) {
        const nft = orders[index];
        if (itemMap.has(nft.token_id)) {
            const item = itemMap.get(nft.token_id);
            nft.rank = item.traits_rank;
            nft.image = item.image_url;
            nft.name = item.name;
            nft.supports_wyvern = item.supports_wyvern;
        } else {
            nft.name = collection.name + " #" + nft.token_id;
            nft.image = collection.image_url;
            nft.rank = 0;
            nft.supports_wyvern = true;
        }
        orders[index] = nft;
    }
    return orders;
};

export const getItemsByTraits = async (collection, traits) => {
    if (_.isEmpty(traits)) {
        return null;
    }
    const items = await OpenseaItems.findAll({
        where: {
            contract_address: collection.contract_address,
        },
    });
    if (items.length == 0) {
        return items;
    }
    const result = [];
    for (const item of items) {
        if (_.isEmpty(item.traits)) {
            continue;
        }
        const traitsMap = _.groupBy(item.traits, function (item) {
            return item.trait_type;
        });

        let allContains = true;
        for (const traitType of Object.keys(traits)) {
            let traitContains = false;
            if (traitType in traitsMap) {
                const traitValues = traitsMap[traitType].map(trait => {
                    return trait.value
                });
                for (const traitValue of traits[traitType]) {
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
            result.push(item);
        }
    }
    return result;
}