import Sequelize from 'sequelize';
import { ethers, BigNumber } from "ethers";
import _ from 'underscore';
import { gotScraping } from 'got-scraping';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

import { LimitOrders, OrderBuyLogs, User, OpenseaCollections, OpenseaItems } from '../dal/db';
import { LimitOrderStatus } from '../model/limit-order-status';
import { BuyStatus } from '../model/buy-status';
import { UserType } from '../model/user-type';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";
import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';
import { randomKey } from '../helpers/opensea/key_utils';

import { redis } from '../dal/mq';

const limiterFlexible = new RateLimiterMemory({
    points: 1,
    duration: 0.2,
})
const limiterQueue = new RateLimiterQueue(limiterFlexible);


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

        const limitOrders = await LimitOrders.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [LimitOrderStatus[LimitOrderStatus.INIT], LimitOrderStatus[LimitOrderStatus.RUNNING]]
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

        for (const limitOrder of limitOrders) {
            if (limitOrder.contract_address !== contractAddress) {
                continue;
            }

            const user = await User.findOne({
                where: {
                    id: limitOrder.user_id
                }
            });

            if (user.valid == 0) {
                continue;
            }

            if (user.type !== UserType[UserType.LIFELONG] && user.expiration_time < new Date()) {
                continue;
            }

            const collection = await OpenseaCollections.findOne({
                where: {
                    contract_address: parseAddress(limitOrder.contract_address)
                }
            });
            if (!collection) {
                continue;
            }
            if (collection.status == 1) {
                continue;
            }

            const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, user.address)));
            if (wethBalance < price) {
                continue;
            }

            const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, user.address)));
            if (wethAllowance < price) {
                continue;
            }

            // collection buy 
            if (_.isEmpty(limitOrder.traits)) {
                await buy(user, limitOrder, contractAddress, tokenId, price);
                continue;
            }
            // buy by traits
            if (!_.isEmpty(limitOrder.traits)) {
                const where = limitOrder.skip_flagged ? {
                    contract_address: collection.contract_address,
                    supports_wyvern: true,
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
                        for (const traitType of Object.keys(limitOrder.traits)) {
                            let traitContains = false;
                            if (traitType in traitsMap) {
                                const traitValues = traitsMap[traitType].map(trait => {
                                    return trait.value
                                });
                                for (const traitValue of limitOrder.traits[traitType]) {
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
                            await buy(user, limitOrder, contractAddress, tokenId, price);
                            continue;
                        }
                    } else {
                        await buy(user, limitOrder, contractAddress, tokenId, price);
                        continue;
                    }
                }
            }

        }



    });
}


const buy = async (user, limitOrder, contractAddress, tokenId, price) => {
    await limiterQueue.removeTokens(1);
    const key = randomKey();

    // https://api.opensea.io/v2/orders/ethereum/seaport/listings?asset_contract_address=0xd532b88607b1877fe20c181cba2550e3bbd6b31c&order_by=eth_price&order_direction=asc&token_ids=5852&limit=1&format=json
    const response = await gotScraping({
        url: `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/orders/${process.env.NETWORK === 'goerli' ? "goerli" : "ethereum"}/seaport/listings?asset_contract_address=${contractAddress}&limit=1&order_by=eth_price&order_direction=asc&format=json`,
        headers: {
            'content-type': 'application/json',
            'X-API-KEY': key
        },
    });
    if (response.statusCode != 200) {
        console.log(`User with id ${user.id} buy ${contractAddress}#${tokenId} with price ${price} error`, response.body);
        return false;
    }
    const orders = JSON.parse(response.body).orders;
    if (!orders || orders.length < 1) {
        console.log(`Get no order for token ${contractAddress}#${tokenId} `, response.body);
        return false;
    }

    const order = orders[0];

    const currentPrice = parseFloat(ethers.utils.formatUnits(order.current_price, 'ether'));
    if (currentPrice <= price) {
        const basicOrderParameters = getBasicOrderParametersFromOrder(order);

        const abi = [
            'function fulfillBasicOrder(tuple(' +
            '        address considerationToken,' +
            '        uint256 considerationIdentifier,' +
            '        uint256 considerationAmount,' +
            '        address offerer,' +
            '        address zone,' +
            '        address offerToken,' +
            '        uint256 offerIdentifier,' +
            '        uint256 offerAmount,' +
            '        uint8 basicOrderType,' +
            '        uint256 startTime,' +
            '        uint256 endTime,' +
            '        bytes32 zoneHash,' +
            '        uint256 salt,' +
            '        bytes32 offererConduitKey,' +
            '        bytes32 fulfillerConduitKey,' +
            '        uint256 totalOriginalAdditionalRecipients,' +
            '        (uint256 amount, address recipient)[] additionalRecipients,' +
            '        bytes signature ) parameters) external payable returns (bool fulfilled)'
        ];


        const iface = new ethers.utils.Interface(abi)
        const calldata = iface.encodeFunctionData("fulfillBasicOrder", [basicOrderParameters]);
        const tx = "";
        // const tx = await signer.sendTransaction({
        //     to: order.protocol_address,
        // });
        await OrderBuyLogs.create({
            user_id: user.id,
            contract_address: contractAddress,
            order_id: limitOrder.id,
            tx: tx,
            price: price,
            status: BuyStatus[BuyStatus.RUNNING],
        });
    }

};

const getBasicOrderParametersFromOrder = (order) => {
    const basicOrderParameters = {
        considerationToken: '0x0000000000000000000000000000000000000000',
        considerationIdentifier: 0,
        considerationAmount: undefined,
        offerer: undefined,
        zone: undefined,
        offerToken: undefined,
        offerIdentifier: undefined,
        offerAmount: 1,
        basicOrderType: 2,
        startTime: undefined,
        endTime: undefined,
        zoneHash: undefined,
        salt: undefined,
        offererConduitKey: undefined,
        fulfillerConduitKey: undefined,
        totalOriginalAdditionalRecipients: undefined,
        additionalRecipients: [],
        signature: undefined
    }
    basicOrderParameters.offerer = ethers.utils.getAddress(order.maker.address);
    basicOrderParameters.zone = order.protocol_data.parameters.zone;
    basicOrderParameters.offerToken = order.protocol_data.parameters.offer[0].token;
    basicOrderParameters.offerIdentifier = order.protocol_data.parameters.offer[0].identifierOrCriteria;
    basicOrderParameters.startTime = order.listing_time;
    basicOrderParameters.endTime = order.expiration_time;
    basicOrderParameters.basicOrderType = order.protocol_data.parameters.orderType;
    basicOrderParameters.zoneHash = order.protocol_data.parameters.zoneHash;
    basicOrderParameters.salt = order.protocol_data.parameters.salt;
    basicOrderParameters.offererConduitKey = order.protocol_data.parameters.conduitKey;
    basicOrderParameters.fulfillerConduitKey = order.protocol_data.parameters.conduitKey;
    basicOrderParameters.totalOriginalAdditionalRecipients = order.protocol_data.parameters.totalOriginalConsiderationItems - 1
    basicOrderParameters.signature = order.protocol_data.signature;
    for (const consider of order.protocol_data.parameters.consideration) {
        if (consider.recipient === basicOrderParameters.offerer) {
            basicOrderParameters.considerationAmount = consider.startAmount;
            continue;
        }

        basicOrderParameters.additionalRecipients.push({
            amount: consider.startAmount,
            recipient: consider.recipient
        });
    }
    return basicOrderParameters;
}

main();


