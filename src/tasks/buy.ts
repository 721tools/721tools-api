import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';
import { OpenSeaSDK, Network } from 'opensea-js';

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
    const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
    await sub.subscribe("OPENSEA-ETH-ORDER-LISTING", async (str) => {
        const message = JSON.parse(str);
        if (message.payload.payload.item.chain.name !== "ethereum" && message.payload.payload.item.chain.name !== process.env.NETWORK) {
            return;
        }

        const tokenSymbol = message.payload.payload.payment_token.Symbol;
        if (tokenSymbol !== "ETH") {
            return;
        }

        // example ethereum/0xded87c5e52c2ddc1934c10e751a1756c4f99ca98/85
        const contractAddress = message.payload.payload.item.nft_id.split("/")[1];
        const tokenId = message.payload.payload.item.nft_id.split("/")[2]
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
                    [Sequelize.Op.gte]: price
                },
                amount: { [Sequelize.Op.gt]: Sequelize.col('purchased') },
                contract_address: contractAddress,
            },
            order: [['id', 'ASC']]
        });

        for (const smartBuy of smartBuys) {
            if (smartBuy.contract_address !== contractAddress) {
                continue;
            }

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

            const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(user.smart_address)));
            if (balance < price) {
                continue;
            }

            if (smartBuy.token_ids) {
                const tokenIds = JSON.parse(smartBuy.token_ids);

                // buy by tokenId
                if (tokenIds.length > 0) {
                    if (tokenIds.includes(tokenId)) {
                        await buy(user, provider, contractAddress, tokenId, price);
                        continue;
                    }
                    continue;
                }
            }



            // collection buy
            if (_.isEmpty(smartBuy.traits) && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                await buy(user, provider, contractAddress, tokenId, price);
                continue;
            }
            // buy by traits and ranks
            if (!_.isEmpty(smartBuy.traits) || (smartBuy.min_rank > 0 && smartBuy.max_rank > 0)) {

                const where = (smartBuy.min_rank > 0 && smartBuy.max_rank > 0) ? {
                    contract_address: collection.contract_address,
                    traits_rank: {
                        [Sequelize.Op.gte]: smartBuy.max_rank,
                        [Sequelize.Op.lte]: smartBuy.min_rank
                    },
                    token_id: parseTokenId(tokenId)
                } : {
                    contract_address: collection.contract_address,
                    token_id: parseTokenId(tokenId),
                };

                const item = await OpenseaItems.findOne({
                    where: where
                });
                if (item) {
                    if (!_.isEmpty(item.traits)) {
                        const traitsMap = _.groupBy(item.traits, function (item) {
                            return item.trait_type;
                        });

                        let allContains = true;
                        for (const traitType of Object.keys(smartBuy.traits)) {
                            let traitContains = false;
                            if (traitType in traitsMap) {
                                const traitValues = traitsMap[traitType].map(trait => {
                                    return trait.value
                                });
                                for (const traitValue of smartBuy.traits[traitType]) {
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
                            await buy(user, provider, contractAddress, tokenId, price);
                            continue;
                        }
                    } else {
                        await buy(user, provider, contractAddress, tokenId, price);
                        continue;
                    }
                }
            }

        }



    });
}


const buy = async (user, provider, contractAddress, tokenId, price) => {
    const kmsSigner = new KmsSigner(user.address, provider);
    const apiKeys = process.env.OPENSEA_API_KEYS.split(",");
    const openseaSDK = new OpenSeaSDK(provider,
        {
            networkName: process.env.NETWORK === 'goerli' ? Network.Goerli : Network.Main,
            apiKey: _.sample(apiKeys),
        },
    );

    // https://api.opensea.io/v2/orders/ethereum/seaport/listings?asset_contract_address=0xc9677cd8e9652f1b1aadd3429769b0ef8d7a0425&format=json&order_by=eth_price&order_direction=desc&token_ids=1159
    const orders = await openseaSDK.api.getOrders({
        assetContractAddress: contractAddress,
        tokenId,
        side: "ask"
    });

    if (orders.orders.length > 0) {
        const currentPrice = parseFloat(ethers.utils.formatUnits(orders.orders[0].currentPrice, 'ether'));
        if (currentPrice <= price) {
            const transactionHash = await openseaSDK.fulfillOrder({ order: orders.orders[0], accountAddress: user.smart_address });
        }
    }
};

main();


