import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';
import { redis } from '../dal/mq';

import { SmartBuys, User, OpenseaCollections, OpenseaItems } from '../dal/db';
import { SmartBuyStatus } from '../model/smart-buy-status';
import { UserType } from '../model/user-type';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";

import { KmsSigner } from '../helpers/kms/kms-signer';

require('../config/env');


async function main(): Promise<void> {
    const sub = redis.duplicate();
    await sub.connect();
    const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'rinkeby' ? process.env.RINKEBY_RPC_URL : process.env.ETH_RPC_URL);
    await sub.subscribe("OPENSEA-ETH-ORDER-LISTING", async (str) => {
        const message = JSON.parse(str);
        if (message.payload.payload.item.chain.name !== "ethereum") {
            return;
        }

        const tokenSymbol = message.payload.payload.payment_token.Symbol;
        if (tokenSymbol !== "ETH") {
            return;
        }

        // example ethereum/0xded87c5e52c2ddc1934c10e751a1756c4f99ca98/85
        const contractAddress = message.payload.payload.item.nft_id.substring(9, 51);
        const tokenId = message.payload.payload.item.nft_id.slice(52);
        const price = parseFloat(ethers.utils.formatUnits(message.payload.payload.base_price, 'ether'));
        const collection_slug = message.payload.payload.collection ? message.payload.payload.collection.slug : '';
        const order_created_date = message.payload.payload.listing_date;
        const order_expiration_date = message.payload.payload.expiration_date;
        const order_event_timestamp = message.payload.payload.event_timestamp;
        const order_sent_at = message.payload.sent_at;

        const smartBuys = await SmartBuys.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [SmartBuyStatus[SmartBuyStatus.INIT], SmartBuyStatus[SmartBuyStatus.RUNNING]]
                },
                expiration_time: {
                    [Sequelize.Op.gt]: new Date()
                },
                price: {
                    [Sequelize.Op.lte]: price
                },
                amount: { [Sequelize.Op.gt]: Sequelize.col('purchased') },
            },
            contract_address: contractAddress,
            order: [['id', 'ASC']]
        });

        for (const smartBuy of smartBuys) {
            const user = await User.findOne({
                where: {
                    id: smartBuy.user_id
                }
            });

            if (user.valid == 0) {
                continue;
            }
            if (!user.smart_address) {
                continue;
            }

            if (user.type !== UserType[UserType.LIFELONG] && user.expiration_time < new Date()) {
                continue;
            }

            const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(user.smart_address)));
            if (balance < price) {
                continue;
            }

            // collection offer
            if (!smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                await buy(user, provider);
                continue;
            }
            // collection offer by traits
            if (smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                const item = await OpenseaItems.findOne({
                    where: {
                        contract_address: parseAddress(smartBuy.contract_address),
                        token_id: parseTokenId(tokenId)
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
                        await buy(user, provider);
                        continue;
                    }
                }
            }

            // offer by rank
            // 所有 items 都有 rank，items 数量大于等于 total_supply
            if (smartBuy.min_rank > 0 || smartBuy.max_rank > 0) {
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
                        token_id: parseTokenId(tokenId)
                    },
                });
                if (items.length > 0) {
                    await buy(user, provider);
                    continue;
                }
            }

            // offer by token id
            if (smartBuy.token_ids) {
                const tokenIds = JSON.parse(smartBuy.token_ids);
                if (tokenIds.includes(tokenId)) {
                    await buy(user, provider);
                    continue;
                }
            }

        }



    });
}

const buy = async (user, provider) => {
    const kmsSigner = new KmsSigner(user.address, provider);
    // @todo buy it!

};

main();


