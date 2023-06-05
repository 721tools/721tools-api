import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';

import { LimitOrders, OrderBuyLogs, User, OpenseaCollections, OpenseaItems, Orders } from '../dal/db';
import { LimitOrderStatus } from '../model/limit-order-status';
import { BuyStatus } from '../model/buy-status';
import { UserType } from '../model/user-type';
import { OrderType } from '../model/order-type';
import { Flatform } from '../model/platform';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";
import { getAuthToken } from "../helpers/blur_utils";
import { buy } from "../helpers/order_utils";
import { traitsMatched } from "../helpers/item_utils";
import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';



async function main(): Promise<void> {
    const limitOrders = await LimitOrders.findAll({
        where: {
            status: {
                [Sequelize.Op.in]: [LimitOrderStatus[LimitOrderStatus.INIT], LimitOrderStatus[LimitOrderStatus.RUNNING]]
            },
            expiration_time: {
                [Sequelize.Op.gt]: new Date()
            },
            amount: { [Sequelize.Op.gt]: Sequelize.col('purchased') },
        },
        order: [['id', 'ASC']]
    });
    for (const limitOrder of limitOrders) {
        const pendingCount = await OrderBuyLogs.count({
            order_id: limitOrder.id,
            status: BuyStatus[BuyStatus.RUNNING]
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


        const where = {
            contract_address: collection.contract_address,
        }
        if (limitOrder.skip_flagged) {
            where['supports_wyvern'] = true;
        }
        if (null != limitOrder.token_ids && limitOrder.token_ids > 0) {
            where['token_id'] = _.map(limitOrder.token_ids, tokenId => parseTokenId(tokenId));
        }
        let items = await OpenseaItems.findAll({
            where: where
        });
        if (!items || items.length == 0) {
            continue;
        }
        items.filter
        items = _.filter(items, (item) => traitsMatched(item.traits, limitOrder.traits));

        const ordersWhere = {
            contract_address: collection.contract_address,
            status: 1,
            type: OrderType.AUCTION_CREATED,
            from: Flatform.BLUR,
            price: {
                [Sequelize.Op.lte]: limitOrder.price,
            },
            order_expiration_date: {
                [Sequelize.Op.gt]: new Date()
            },
            owner_address: {
                [Sequelize.Op.ne]: parseAddress(user.address)
            }
        };

        if (items != null && items.length > 0) {
            const tokenIds = _.map(items, (item) => item.token_id);
            ordersWhere['token_id'] = tokenIds;
        }

        const orders = await Orders.findAll({
            where: ordersWhere,
            order: [
                ["id", "DESC"]
            ],
            limit: 30,
        });

        if (!orders || orders.length == 0) {
            continue;
        }


        const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
        const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, user.address)));
        if (wethBalance < limitOrder.price) {
            continue;
        }

        const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, user.address)));
        if (wethAllowance < limitOrder.price) {
            continue;
        }

        const tokens = _.map(orders, (item) => {
            return {
                platform: Flatform.BLUR,
                token_id: parseInt(item.token_id.toString("hex"), 16).toString(),
                price: item.price,
            }
        });
        await buy(provider, user, limitOrder, limitOrder.contract_address, tokens, await getAuthToken());
        continue;
    }
}


while (true) {
    main();
}


