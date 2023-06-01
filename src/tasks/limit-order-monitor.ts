import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';


import { LimitOrders, OrderBuyLogs, OrderFilleds } from "../dal/db";
import { LimitOrderStatus } from '../model/limit-order-status';
import { BuyStatus } from '../model/buy-status';

async function main(): Promise<void> {
    const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
    while (true) {
        const orderBuyLogs = await OrderBuyLogs.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [BuyStatus[BuyStatus.RUNNING]]
                },
            },
            order: [['id', 'ASC']]
        });

        const groupedOrderBuyLogs = _.groupBy(orderBuyLogs, function (orderBuyLog) {
            return orderBuyLog.order_id + "-" + orderBuyLog.tx;
        });
        for (const orderIdAndTx of Object.keys(groupedOrderBuyLogs)) {
            let currentPurchased = 0;
            const orderId = orderIdAndTx.split("-")[0];
            const tx = orderIdAndTx.split("-")[1];

            const toBequeriedOrders = [];
            const logs = groupedOrderBuyLogs[orderIdAndTx];
            for (const log of logs) {
                toBequeriedOrders.push({
                    "address": ethers.utils.getAddress(log.contract_address),
                    "tokenId": log.token_id,
                    "tx_hash": log.tx,
                });
            }
            const orderFilleds = await OrderFilleds.findAll({ where: { [Sequelize.Op.or]: toBequeriedOrders } });
            const groupedOrderFilleds = _.groupBy(orderFilleds, function (orderFilled) {
                return orderFilled.address + "-" + orderFilled.tokenId + "-" + orderFilled.tx_hash;
            });
            for (const log of logs) {
                const mapKey = ethers.utils.getAddress(log.contract_address) + "-" + log.token_id + "-" + log.tx;
                if (mapKey in groupedOrderFilleds) {
                    const currentOrderFilleds = groupedOrderFilleds[mapKey];
                    for (const orderFilled of currentOrderFilleds) {
                        currentPurchased += parseInt(orderFilled.amount);
                    }
                    await log.update({
                        status: BuyStatus[BuyStatus.SUCCESS],
                    });
                }
            }
            if (currentPurchased > 0) {
                const limitOrder = await LimitOrders.findOne({
                    where: {
                        id: orderId
                    }
                });
                console.log(`Limit order ${limitOrder.id} successed ${parseInt(limitOrder.purchased) + currentPurchased} items, ${parseInt(limitOrder.amount) - parseInt(limitOrder.purchased) - currentPurchased} left`)

                if (parseInt(limitOrder.purchased) + currentPurchased == parseInt(limitOrder.amount)) {
                    await limitOrder.update({
                        status: LimitOrderStatus[LimitOrderStatus.FINISHED],
                        purchased: parseInt(limitOrder.purchased) + currentPurchased
                    });
                } else {
                    await limitOrder.update({
                        purchased: parseInt(limitOrder.purchased) + currentPurchased
                    });
                }

            } else {
                const txReceipt = await provider.getTransactionReceipt(tx);
                if (txReceipt.status == 0) {
                    await OrderBuyLogs.update({
                        status: BuyStatus[BuyStatus.FAILED]
                    }, {
                        where: {
                            order_id: orderId,
                            tx: tx,
                        }
                    });
                }
            }
        };


    }
}



main();


