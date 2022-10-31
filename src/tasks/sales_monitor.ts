import Sequelize from 'sequelize';
import _ from 'underscore';

import { SmartBuys, User, OpenseaCollections, OpenseaItems, NFTTrades } from '../dal/db';
import { SmartBuyStatus } from '../model/smart-buy-status';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";

async function main(): Promise<void> {
    while (true) {
        const smartBuys = await SmartBuys.findAll({
            where: {
                expiration_time: {
                    [Sequelize.Op.gt]: new Date()
                },
                amount: { [Sequelize.Op.gt]: Sequelize.col('purchased') }
            },
            order: [['id', 'ASC']]
        });

        for (const smartBuy of smartBuys) {
            const user = await User.findOne({
                where: {
                    id: smartBuy.user_id
                }
            });

            await smartBuy.update({ last_scan_time: new Date() });

            const nftTrades = await NFTTrades.findAll({
                where: {
                    address: smartBuy.contract_address,
                    buyer: user.smart_address,
                    timestamp: {
                        [Sequelize.Op.gte]: smartBuy.last_scan_time
                    },
                }
            });
            if (nftTrades && nftTrades.length == 0) {
                continue;
            }

            let purchased = 0;
            for (const nftTrade of nftTrades) {
                // collection offer
                if (!smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                    purchased += nftTrade.amount;
                    continue;
                }
                // collection offer by traits
                if (smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                    const item = await OpenseaItems.findOne({
                        where: {
                            contract_address: parseAddress(smartBuy.contract_address),
                            token_id: parseTokenId(nftTrade.tokenId)
                        }
                    });
                    if (item && item.traits) {
                        // 同个 trait 包含一个
                        // 不同 trait 都包含
                        const traitsMap = _.groupBy(item.traits, function (item) {
                            return item.trait_type;
                        });
                        let allContains = true;
                        for (let traitType in traitsMap) {
                            let traitContains = false;
                            for (let traitIndex in traitsMap[traitType]) {
                                let traitValue = traitsMap[traitType][traitIndex].value;
                                for (let tokenTraitIndex in item.trait) {
                                    if (item.traits[tokenTraitIndex].type == traitType && item.traits[tokenTraitIndex].value == traitValue) {
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
                            purchased += nftTrade.amount;
                            continue;
                        }
                    }
                }

                // offer by rank
                // 所有 items 都有 rank，items 数量大于等于 total_supply
                if (smartBuy.min_rank > 0 && smartBuy.max_rank > 0) {
                    if (smartBuy.max_rank < smartBuy.min_rank) {
                        continue;
                    }

                    const collection = await OpenseaCollections.findOne({
                        where: {
                            contract_address: parseAddress(smartBuy.contract_address)
                        }
                    });
                    if (!collection) {
                        continue;
                    }
                    if (collection.status == 1) {
                        continue;
                    }
                    const itemsCount = await OpenseaItems.count({
                        where: {
                            contract_address: collection.contract_address,
                            traits_rank: {
                                [Sequelize.Op.gt]: 0
                            },
                        },
                    });
                    if (itemsCount < collection.total_supply) {
                        continue;
                    }
                    const items = await OpenseaItems.findAll({
                        where: {
                            contract_address: collection.contract_address,
                            traits_rank: {
                                [Sequelize.Op.gte]: smartBuy.max_rank,
                                [Sequelize.Op.lte]: smartBuy.min_rank
                            },
                            token_id: parseTokenId(nftTrade.tokenId)
                        },
                    });
                    if (items.length > 0) {
                        purchased += nftTrade.amount;
                        continue;
                    }
                }

                // offer by token id
                if (smartBuy.token_ids) {
                    const tokenIds = JSON.parse(smartBuy.token_ids);
                    if (tokenIds.includes(nftTrade.tokenId)) {
                        purchased += nftTrade.amount;
                        continue;
                    }
                }
            }

            if (purchased > smartBuy.purchased) {
                if (purchased >= smartBuy.amount) {
                    await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.FINISHED], purchased: purchased });
                } else {
                    await smartBuy.update({ purchased: purchased });
                }
                continue;
            }

        }
    }
}


main();
