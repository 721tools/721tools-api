import Sequelize from 'sequelize';
import { ethers, utils } from "ethers";
import _ from 'underscore';
import fs from "fs";
import path from "path";
import { gotScraping } from 'got-scraping';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

import { LimitOrders, OrderBuyLogs, User, OpenseaCollections, OpenseaItems } from '../dal/db';
import { LimitOrderStatus } from '../model/limit-order-status';
import { BuyStatus } from '../model/buy-status';
import { UserType } from '../model/user-type';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";
import { getBasicOrderParametersFromOrder } from '../helpers/order_utils';
import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';
import { randomKey } from '../helpers/opensea/key_utils';
const j721toolsAbi = fs.readFileSync(path.join(__dirname, '../abis/J721Tools.json')).toString();
const seaportProxyAbi = fs.readFileSync(path.join(__dirname, '../abis/SeaportProxy.json')).toString();

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

            const pendingCount = await OrderBuyLogs.count({
                order_id: limitOrder.id,
                status: BuyStatus[BuyStatus.RUNNING]
            });

            if (pendingCount + limitOrder.purchased >= limitOrder.amount) {
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
            if (!item) {
                continue;
            }

            // collection buy 
            if (_.isEmpty(limitOrder.traits)) {
                await buy(provider, user, limitOrder, contractAddress, tokenId, price);
                continue;
            }
            // buy by traits
            if (!_.isEmpty(limitOrder.traits)) {
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
                        await buy(provider, user, limitOrder, contractAddress, tokenId, price);
                        continue;
                    }
                } else {
                    await buy(provider, user, limitOrder, contractAddress, tokenId, price);
                    continue;
                }
            }

        }



    });
}


const buy = async (provider, user, limitOrder, contractAddress, tokenId, price) => {
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
    if (currentPrice > price) {
        return;
    }
    const profit = price - currentPrice;
    if (profit <= 0.01) {
        return;
    }

    const basicOrderParameters = getBasicOrderParametersFromOrder(order);

    const openseaIface = new ethers.utils.Interface(seaportProxyAbi)
    const calldata = openseaIface.encodeFunctionData("buyAssetsForEth", [[basicOrderParameters]]);
    let j721toolsIface = new ethers.utils.Interface(j721toolsAbi);
    const data = j721toolsIface.encodeFunctionData("batchBuyWithETH", [[0, order.current_price, calldata]]);

    const gasLimit = await provider.estimateGas({
        to: order.protocol_address,
        data: data,
        value: utils.parseEther(currentPrice.toString())
    });
    const feeData = await provider.getFeeData();

    const totalGas = parseFloat(ethers.utils.formatUnits(gasLimit.mul(feeData.gasPrice), 'ether'));

    if (totalGas > profit) {
        return;
    }

    if (totalGas > profit + 0.01) {
        return;
    }

    const signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(signer.address)));
    if (balance < (totalGas + currentPrice)) {
        return;
    }


    // 1: batchBuyWithETH 
    // 2: fillOrder
    // 3: Unwrap WETH

    // @todo call by other wallet with apporved weth
    const tx = await signer.sendTransaction({
        to: order.protocol_address,
        data: data,
        value: order.current_price
    });

    await OrderBuyLogs.create({
        user_id: user.id,
        contract_address: contractAddress,
        order_id: limitOrder.id,
        tx: tx,
        price: price,
        status: BuyStatus[BuyStatus.RUNNING],
    });

};

main();


