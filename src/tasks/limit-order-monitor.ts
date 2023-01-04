import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';


import { LimitOrders, OrderBuyLogs } from "../dal/db";
import { LimitOrderStatus } from '../model/limit-order-status';
import { BuyStatus } from '../model/buy-status';

async function main(): Promise<void> {
    while (true) {
        const orderBuyLogs = await OrderBuyLogs.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [BuyStatus[BuyStatus.RUNNING]]
                },
            },
            order: [['id', 'ASC']]
        });

        const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
        for (const orderBuyLog of orderBuyLogs) {
            const txReceipt = await provider.getTransactionReceipt(orderBuyLog.tx);
            if (txReceipt.status == 1) {
                await orderBuyLog.update({
                    status: BuyStatus[BuyStatus.SUCCESS]
                });
                const limitOrder = await LimitOrders.findOne({
                    where: {
                        id: orderBuyLog.order_id
                    }
                });

                // @todo handle one tx buy many
                if (limitOrder.purchased + 1 == limitOrder.amount) {
                    await limitOrder.update({
                        status: LimitOrderStatus[LimitOrderStatus.FINISHED],
                        purchased: limitOrder.purchased + 1
                    });
                } else {
                    await limitOrder.update({
                        purchased: limitOrder.purchased + 1
                    });
                }
            } else {
                await orderBuyLog.update({
                    status: BuyStatus[BuyStatus.FAILED]
                });
            }
            continue
        }
    }
}



main();


