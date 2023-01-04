import Sequelize from 'sequelize';
import { ethers } from "ethers";
import _ from 'underscore';


import { LimitOrders, User, OpenseaCollections } from "../dal/db";
import { LimitOrderStatus } from '../model/limit-order-status';
import { UserType } from '../model/user-type';
import { parseAddress } from "../helpers/binary_utils";

import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';


async function main(): Promise<void> {
    while (true) {
        const limitOrders = await LimitOrders.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [LimitOrderStatus[LimitOrderStatus.INIT], LimitOrderStatus[LimitOrderStatus.RUNNING], LimitOrderStatus[LimitOrderStatus.WETH_NOT_ENOUGH], LimitOrderStatus[LimitOrderStatus.WETH_ALLOWANCE_NOT_ENOUGH]]
                },
                amount: { [Sequelize.Op.gt]: Sequelize.col('purchased') }
            },
            order: [['id', 'ASC']]
        });

        for (const limitOrder of limitOrders) {
            const user = await User.findOne({
                where: {
                    id: limitOrder.user_id
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
                    contract_address: parseAddress(limitOrder.contract_address)
                }
            });
            if (!collection) {
                continue;
            }
            if (collection.status == 1) {
                continue;
            }

            const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);

            const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, user.address)));
            if (wethBalance < limitOrder.price * (limitOrder.amount - limitOrder.purchased)) {
                await limitOrder.update({
                    status: LimitOrderStatus[LimitOrderStatus.WETH_NOT_ENOUGH],
                    error_details: ""
                });
                continue;
            }

            const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, user.address)));
            if (wethAllowance < limitOrder.price * (limitOrder.amount - limitOrder.purchased)) {
                await limitOrder.update({
                    status: LimitOrderStatus[LimitOrderStatus.WETH_ALLOWANCE_NOT_ENOUGH],
                    error_details: ""
                });
                continue;
            }
            if (limitOrder.expiration_time < new Date()) {
                await limitOrder.update({
                    status: LimitOrderStatus[LimitOrderStatus.EXPIRED],
                    error_details: ""
                });
                continue;
            }

            if (limitOrder.status !== LimitOrderStatus[LimitOrderStatus.RUNNING]) {
                await limitOrder.update({
                    status: LimitOrderStatus[LimitOrderStatus.RUNNING],
                    error_details: ""
                });
            }

            continue
        }
    }
}



main();


