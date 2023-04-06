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
import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';

import { redis } from '../dal/mq';


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

            const tokenIds = limitOrder.token_ids;
            if (null != tokenIds && tokenIds.length > 0) {
                if (!tokenIds.includes(tokenId)) {
                    continue;
                }
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

            const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, user.address)));
            if (wethBalance < price) {
                continue;
            }

            const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, user.address)));
            if (wethAllowance < price) {
                continue;
            }
            await buy(provider, user, limitOrder, contractAddress, [{
                platform: Flatform.OPENSEA,
                token_id: tokenId,
                price: price,
            }]);
            continue;
        }



    });
}


main();


