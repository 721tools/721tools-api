import Sequelize from 'sequelize';
import { ethers, BigNumber } from "ethers";
import _ from 'underscore';


import { SmartBuys, SmartBuyLogs, User, OpenseaCollections, OpenseaItems } from '../dal/db';
import { SmartBuyStatus } from '../model/smart-buy-status';
import { SmartBuyType } from '../model/smart-buy-type';
import { HttpError } from '../model/http-error';
import { UserType } from '../model/user-type';
import { preCreateCollectionOffer, postCreateCollectionOffer, queryCollectionOfferMultiModalBase } from '../helpers/opensea/collection_offer';
import { preCreateOffer } from '../helpers/opensea/bid';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";

import { KmsSigner } from '../helpers/kms/kms-signer';
import { getWethAllowance, getWethBalance, approveWeth } from '../helpers/opensea/erc20_utils';

require('../config/env');

async function main(): Promise<void> {
    while (true) {
        const smartBuys = await SmartBuys.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [SmartBuyStatus[SmartBuyStatus.INIT], SmartBuyStatus[SmartBuyStatus.RUNNING]]
                },
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

            if (user.valid == 0) {
                continue;
            }
            if (!user.smart_address) {
                continue;
            }

            if (user.type !== UserType[UserType.LIFELONG] && user.expiration_time < new Date()) {
                continue;
            }

            const count = await SmartBuyLogs.count({
                where: {
                    type: {
                        [Sequelize.Op.in]: [SmartBuyType[SmartBuyType.OFFER], SmartBuyType[SmartBuyType.COLLECTION_OFFER]]
                    },
                    create_time: {
                        [Sequelize.Op.lt]: new Date(new Date().getTime() + 60 * 60 * 24 * 1000)
                    },
                    smart_buy_id: smartBuy.id,
                    contract_address: smartBuy.contract_address,
                },
            });
            if (count > 0) {
                continue;
            }

            const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'rinkeby' ? process.env.RINKEBY_RPC_URL : process.env.ETH_RPC_URL);
            const kmsSigner = new KmsSigner(user.address, provider);

            const wethBalance = await getWethBalance(kmsSigner, user.smart_address);
            if (wethBalance.lt(ethers.utils.parseEther(smartBuy.price))) {
                const ethBalance = await provider.getBalance(user.smart_address);
                if (ethBalance.lt(ethers.utils.parseEther(smartBuy.price))) {
                    await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.WALLET_ETH_INSUFFICIEN], error_details: "ETH balance insufficient" });
                }
                continue;
            }

            const wethAllowance = await getWethAllowance(kmsSigner, user.smart_address);
            if (wethAllowance.lte(BigNumber.from(0))) {
                try {
                    const tx = await approveWeth(kmsSigner);
                    const receipt = await tx.wait();
                    if (receipt.status == 0) {
                        console.log(`${user.smart_address} approve weth error`, receipt);
                        continue;
                    } else {
                        console.log(`${user.smart_address} approve weth success`);
                    }
                } catch (error) {
                    console.log(`${user.smart_address} approve weth error`, error);
                    continue;
                }
            } else if (wethAllowance.lt(ethers.utils.parseEther(smartBuy.price))) {
                continue;
            }


            // collection offer
            if (!smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                const preActionResult = await preCreateCollectionOffer(kmsSigner, user.smart_address, smartBuy.contract_address, smartBuy.slug, null, smartBuy.price, 1)
                if (preActionResult.errors) {
                    console.log(`Failed to make pre collection offer for smart buy: ${smartBuy.id}, ${JSON.stringify(preActionResult.errors)}`);
                    await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.OS_BID_ERROR], error_details: JSON.stringify(preActionResult.errors) });
                    continue;
                }
                const postActionResult = await postCreateCollectionOffer(preActionResult);
                if (postActionResult.errors) {
                    console.log(`Failed to make post collection offer for smart buy: ${smartBuy.id}, ${JSON.stringify(postActionResult.errors)}`);
                    await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.OS_BID_ERROR], error_details: JSON.stringify(preActionResult.errors) });
                    continue;
                }

                console.log(`Make collection offer for smart buy ${smartBuy.id} success`);
                await SmartBuyLogs.create({
                    user_id: user.id,
                    contract_address: smartBuy.contract_address,
                    smart_buy_id: smartBuy.id,
                    type: SmartBuyType[SmartBuyType.COLLECTION_OFFER]
                });
                continue;
            }

            // collection offer by traits
            if (smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                const traitKeys = Object.keys(smartBuy.traits);
                if (traitKeys.length == 1) {
                    const isTraitOffersEnabled = await queryCollectionOfferMultiModalBase(smartBuy.slug);
                    if (isTraitOffersEnabled) {
                        for (const traitKey of traitKeys) {
                            for (const traitValue of smartBuy.traits[traitKey]) {
                                const preActionResult = await preCreateCollectionOffer(kmsSigner, user.smart_address, smartBuy.contract_address, smartBuy.slug, {
                                    name: traitKey,
                                    value: traitValue
                                }, smartBuy.price, 1)
                                if (preActionResult.errors) {
                                    console.log(`Failed to make pre collection offer by trait ${traitKey}:${traitValue} for smart buy: ${smartBuy.id}, ${JSON.stringify(preActionResult.errors)}`);
                                    await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.OS_BID_ERROR], error_details: JSON.stringify(preActionResult.errors) });
                                    continue;
                                }
                                const postActionResult = await postCreateCollectionOffer(preActionResult);
                                if (postActionResult.errors) {
                                    console.log(`Failed to make post collection offer by trait ${traitKey}:${traitValue} for smart buy: ${smartBuy.id}, ${JSON.stringify(postActionResult.errors)}`);
                                    await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.OS_BID_ERROR], error_details: JSON.stringify(preActionResult.errors) });
                                    continue;
                                }
                                console.log(`Make collection offer by trait ${traitKey}:${traitValue} for smart buy ${smartBuy.id} success`);
                            }
                        }

                        await SmartBuyLogs.create({
                            user_id: user.id,
                            contract_address: smartBuy.contract_address,
                            smart_buy_id: smartBuy.id,
                            type: SmartBuyType[SmartBuyType.COLLECTION_OFFER]
                        });

                        continue;
                    }
                }

                let tokenIds = new Set();
                const items = await OpenseaItems.findAll({
                    where: {
                        contract_address: Buffer.from(smartBuy.contract_address.slice(2), 'hex')
                    }
                });
                for (const item of items) {
                    if (item.traits) {
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
                            tokenIds.add(item.token_id);
                        }
                    }
                }
                if (tokenIds.size > 0) {
                    await singleBid(kmsSigner, smartBuy, user, tokenIds, []);
                    continue;
                }
            }

            // offer by rank
            // 所有 items 都有 rank，items 数量大于等于 total_supply
            if (smartBuy.min_rank > 0 || smartBuy.max_rank > 0) {
                if (smartBuy.max_rank < smartBuy.min_rank) {
                    // todo change status to error
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
                    },
                });
                if (items.length > 0) {
                    await singleBid(kmsSigner, smartBuy, user, [], items);
                }

            }


            // offer by token id
            if (smartBuy.token_ids) {
                const tokenIds = JSON.parse(smartBuy.token_ids);
                if (tokenIds.length > 0) {
                    await singleBid(kmsSigner, smartBuy, user, smartBuy.token_ids, []);
                }
            }
            continue
        }
    }
}

const singleBid = async (kmsSigner, smartBuy, user, tokenIds, items) => {
    if (!items) {
        items = await OpenseaItems.findAll({
            where: {
                contract_address: parseAddress(smartBuy.contract_address),
                token_id: _.map(tokenIds, tokenId => parseTokenId(tokenId))
            }
        });
    }
    for (const item of items) {
        const preActionResult = await preCreateOffer(kmsSigner, user.smart_address, item.asset_id, smartBuy.price, 1)
        if (preActionResult.errors) {
            console.log(`Failed to make pre offer for smart buy: ${smartBuy.id}, ${JSON.stringify(preActionResult.errors)}, assetId:${item.asset_id}`);
            await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.OS_BID_ERROR], error_details: JSON.stringify(preActionResult.errors) })
            return;
        }
        const postActionResult = await postCreateCollectionOffer(preActionResult);
        if (postActionResult.errors) {
            console.log(`Failed to make post offer for smart buy: ${smartBuy.id}, ${JSON.stringify(postActionResult.errors)}`);
            await smartBuy.update({ status: SmartBuyStatus[SmartBuyStatus.PAUSED], error_code: HttpError[HttpError.OS_BID_ERROR], error_details: JSON.stringify(preActionResult.errors) })
            return;
        }
    }
    await SmartBuyLogs.create({
        user_id: user.id,
        contract_address: smartBuy.contract_address,
        smart_buy_id: smartBuy.id,
        type: SmartBuyType[SmartBuyType.COLLECTION_OFFER]
    });

}



main();


