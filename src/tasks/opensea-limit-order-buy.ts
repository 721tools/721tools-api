import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';

import { LimitOrders, OrderBuyLogs, User, OpenseaCollections, OpenseaItems } from '../dal/db';
import { LimitOrderStatus } from '../model/limit-order-status';
import { BuyStatus } from '../model/buy-status';
import { UserType } from '../model/user-type';
import { Flatform } from '../model/platform';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";
import { buy } from "../helpers/order_utils";
import { traitsMatched } from "../helpers/item_utils";

import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';

import { redis } from '../dal/mq';

const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);

async function main(): Promise<void> {
    // const sub = redis.duplicate();
    // await sub.connect();
    // await sub.subscribe("OPENSEA-ETH-ORDER-LISTING", async (str) => {
    //     console.log(str);
    //     await handleMessage(str);
    // });
    await handleMessage(`{"topic":"collection:*","event":"item_listed","payload":{"event_type":"item_listed","payload":{"event_timestamp":"2023-06-09T07:25:52.693814+00:00","base_price":"30000000000000000","collection":{"slug":"wonderpalsgoerli"},"expiration_date":"2023-07-09T07:25:40.000000+00:00","is_private":false,"listing_date":"2023-06-09T07:25:40.000000+00:00","listing_type":"","maker":{"address":"0xf9b95cb9f9afa8a9971a65001bc2905327dee682"},"payment_token":{"address":"0x0000000000000000000000000000000000000000","decimals":18,"eth_price":0,"name":"Ether","Symbol":"ETH","usd_price":"1837.500000000000000000"},"item":{"chain":{"name":"goerli"},"metadata":{"animation_url":"","image_url":"https://i.seadn.io/gcs/files/b96f1fe4622116a524faf3580edb8b62.png?w=500\u0026auto=format","metadata_url":"https://wonderpals.mypinata.cloud/ipfs/QmSvKdz3ecY3tKT4k7bcMnwPHXRby7tSLfPCngtb1Eq9PQ/66","name":"WonderPal #66"},"nft_id":"goerli/0x424418b6052902cdbdde600450252f681505b04e/66","permalink":"https://testnets.opensea.io/assets/goerli/0x424418b6052902cdbdde600450252f681505b04e/66"},"quantity":1,"taker":""},"sent_at":"2023-06-09T07:25:52.966634+00:00"},"ref":0}`)
}

const handleMessage = async (str) => {
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
    const owner_address = message.payload.payload.maker.address;
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
            where: {
                order_id: limitOrder.id,
                status: BuyStatus[BuyStatus.RUNNING]
            }
        });

        if (pendingCount > 0) {
            console.log(`Skip limit order ${limitOrder.id}, have ${pendingCount} pendings`)
            continue;
        }

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
        if (ethers.utils.getAddress(limitOrder.offerer) == ethers.utils.getAddress(owner_address)) {
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

        const tokenIds = limitOrder.token_ids;
        if (null != tokenIds && tokenIds.length > 0) {
            if (!tokenIds.includes(tokenId)) {
                continue;
            }
        }
        if (limitOrder.skip_flagged || !_.isEmpty(limitOrder.traits)) {
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
            if (!traitsMatched(item.traits, limitOrder.traits)) {
                continue;
            }
        }


        const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, limitOrder.offerer)));
        if (wethBalance < price) {
            continue;
        }

        const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, limitOrder.offerer)));
        if (wethAllowance < price) {
            continue;
        }
        await buy(provider, user, limitOrder, contractAddress, [{
            platform: Flatform.OPENSEA,
            token_id: tokenId,
            price: price,
        }], "");
        continue;
    }
}


main();


