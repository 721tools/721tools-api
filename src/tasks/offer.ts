import Sequelize from 'sequelize';

import { SmartBuys, SmartBuyLogs, User } from '../dal/db';
import { SmartBuyStatus } from '../model/smart-buy-status';
import { SmartBuyType } from '../model/smart-buy-type';
import { UserType } from '../model/user-type';
import { preCreateCollectionOffer, postCreateCollectionOffer } from '../helpers/opensea/colletion_offer';


async function main(): Promise<void> {
    // while (true) {
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

        if (user.type !== UserType[UserType.LIFELONG] && user.expiration_time < new Date()) {
            continue;
        }

        const count = await SmartBuyLogs.count({
            where: {
                type: {
                    [Sequelize.Op.in]: [SmartBuyType[SmartBuyType.OFFER], SmartBuyType[SmartBuyType.COLLECTION_OFFER]]
                },
                create_time: {
                    [Sequelize.Op.lt]: new Date(new Date().getTime() - 60 * 60 * 24 * 1000)
                },
                smart_buy_id: smartBuy.id,
                contract_address: smartBuy.contract_address,
            },
        });
        if (count > 0) {
            continue;
        }

        // @todo judge balance first
        if (!smartBuy.traits && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
            const preActionResult = await preCreateCollectionOffer(user.address, user.smart_address, smartBuy.contract_address, smartBuy.slug, 1, smartBuy.price)
            if (preActionResult.errors) {
                console.log(`Failed to make pre collection offer for smart buy: ${smartBuy.id}, ${JSON.stringify(preActionResult.errors)}`);
                continue;
            }
            const postActionResult = await postCreateCollectionOffer(preActionResult);
            if (postActionResult.errors) {
                console.log(`Failed to make post collection offer for smart buy: ${smartBuy.id}, ${JSON.stringify(postActionResult.errors)}`);
                continue;
            }
            console.log(JSON.stringify(postActionResult));
        }
    }
}
// }



main();


