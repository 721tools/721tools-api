import { OpenseaItems } from '../dal/db';
import { parseTokenId } from "../helpers/binary_utils";

export const setItemInfo = async (items, collection) => {
    if (items && items.length > 0) {
        const selectTokens = [];
        const isStringTokenId = typeof items[0].token_id;
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
            const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => [isStringTokenId ? item.token_id : parseInt(item.token_id.toString("hex"), 16).toString(), item.dataValues]));
            for (let index in items) {
                const nft = items[index];
                const tokenId = isStringTokenId ? nft.token_id : parseInt(nft.token_id.toString("hex"), 16).toString()
                if (itemMap.has(tokenId)) {
                    const item = itemMap.get(tokenId);
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
                items[index] = nft;
            }
        }
    }
    return items;
};