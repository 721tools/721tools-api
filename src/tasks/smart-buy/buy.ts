import Sequelize from 'sequelize';
import { ethers, BigNumber } from "ethers";
import _ from 'underscore';
import { gotScraping } from 'got-scraping';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';

import { getBasicOrderParametersFromOrder } from '../../helpers/order_utils';
import { SmartBuys, User, OpenseaCollections, OpenseaItems } from '../../dal/db';
import { SmartBuyStatus } from '../../model/smart-buy-status';
import { SignType } from '../../model/sign-type';
import { UserType } from '../../model/user-type';
import { parseTokenId, parseAddress } from "../../helpers/binary_utils";

import { KmsSigner } from '../../helpers/kms/kms-signer';

import { redis } from '../../dal/mq';

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

        const smartBuys = await SmartBuys.findAll({
            where: {
                status: {
                    [Sequelize.Op.in]: [SmartBuyStatus[SmartBuyStatus.INIT], SmartBuyStatus[SmartBuyStatus.RUNNING]]
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

        for (const smartBuy of smartBuys) {
            if (smartBuy.contract_address !== contractAddress) {
                continue;
            }

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

            const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(user.smart_address)));
            if (balance < price) {
                continue;
            }

            if (smartBuy.token_ids) {
                const tokenIds = JSON.parse(smartBuy.token_ids);

                // buy by tokenId
                if (tokenIds.length > 0) {
                    if (tokenIds.includes(tokenId)) {
                        await buy(user, provider, contractAddress, tokenId, price);
                        continue;
                    }
                    continue;
                }
            }



            // collection buy
            if (_.isEmpty(smartBuy.traits) && smartBuy.min_rank == 0 && smartBuy.max_rank == 0) {
                await buy(user, provider, contractAddress, tokenId, price);
                continue;
            }
            // buy by traits and ranks
            if (!_.isEmpty(smartBuy.traits) || (smartBuy.min_rank > 0 && smartBuy.max_rank > 0)) {

                const where = (smartBuy.min_rank > 0 && smartBuy.max_rank > 0) ? {
                    contract_address: collection.contract_address,
                    traits_rank: {
                        [Sequelize.Op.gte]: smartBuy.max_rank,
                        [Sequelize.Op.lte]: smartBuy.min_rank
                    },
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
                        for (const traitType of Object.keys(smartBuy.traits)) {
                            let traitContains = false;
                            if (traitType in traitsMap) {
                                const traitValues = traitsMap[traitType].map(trait => {
                                    return trait.value.toLowerCase();
                                });
                                for (const traitValue of smartBuy.traits[traitType]) {
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
                            await buy(user, provider, contractAddress, tokenId, price);
                            continue;
                        }
                    } else {
                        await buy(user, provider, contractAddress, tokenId, price);
                        continue;
                    }
                }
            }

        }



    });
}


const buy = async (user, provider, contractAddress, tokenId, price) => {
    await limiterQueue.removeTokens(1);
    // https://api.opensea.io/v2/orders/ethereum/seaport/listings?asset_contract_address=0xd532b88607b1877fe20c181cba2550e3bbd6b31c&order_by=eth_price&order_direction=asc&token_ids=5852&limit=1&format=json
    const response = await gotScraping({
        url: `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/orders/${process.env.NETWORK === 'goerli' ? "goerli" : "ethereum"}/seaport/listings?asset_contract_address=${contractAddress}&token_ids=${tokenId}&order_by=eth_price&order_direction=asc&limit=1&format=json`,
        headers: {
            'content-type': 'application/json',
        },
    });
    if (response.statusCode != 200) {
        console.log(`User with id ${user.id} buy ${contractAddress}#${tokenId} with price ${price} error`, response.body);
        return false;
    }
    const orders = JSON.parse(response.body).orders;
    if (!orders || orders.length < 1) {
        console.log(`Get no order for token ${contractAddress}#${tokenId}`, response.body);
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

        const kmsSigner = new KmsSigner(user.address, provider);
        // const contract = new ethers.Contract(order.protocol_address, abi, kmsSigner);
        // const tx = await contract.fulfillBasicOrder(basicOrderParameters, { value: ethers.BigNumber.from(order.current_price) });



        // const flashbotsProvider = await FlashbotsBundleProvider.create(provider, kmsSigner,
        //     process.env.NETWORK === 'goerli' ? "https://relay-goerli.flashbots.net" : "https://relay.flashbots.ne"
        // );

        // const iface = new ethers.utils.Interface(abi)
        // const calldata = iface.encodeFunctionData("fulfillBasicOrder", [basicOrderParameters]);
        const tx = await kmsSigner.sendTransaction({
            to: order.protocol_address,
            value: ethers.BigNumber.from(order.current_price),
            customData: { signType: SignType[SignType.OS_BUY], data: basicOrderParameters },
        });

        const tr = await tx.wait();
        if (tr.status == 1) {
            console.log(`User with id ${user.id} buy ${contractAddress}#${tokenId} with price ${price} success, hash ${tr.transactionHash}`);
        } else {
            console.log(`User with id ${user.id} buy ${contractAddress}#${tokenId} with price ${price} error, hash ${tr.transactionHash}`);
        }

        // const baseFee = (await provider.getBlock("latest")).baseFeePerGas as BigNumber;

        // const signedTransactions = await flashbotsProvider.signBundle([{
        //     transaction: {
        //         chainId: process.env.NETWORK === 'goerli' ? 5 : 1,
        //         value: ethers.BigNumber.from(order.current_price),
        //         data: calldata,
        //         to: order.protocol_address,
        //         gasPrice: baseFee.mul(13).div(10),
        //     },
        //     signer: kmsSigner
        // }]);

        // const blockNumber = await provider.getBlockNumber();
        // const BLOCKS_IN_FUTURE = 1;
        // const targetBlockNumber = blockNumber + BLOCKS_IN_FUTURE;

        // const bundleResponse = await flashbotsProvider.sendRawBundle(signedTransactions, targetBlockNumber);
        // if ('error' in bundleResponse) {
        //     throw new Error(bundleResponse.error.message)
        // }
        // const bundleResolution = await bundleResponse.wait()
        // if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
        //     console.log(`Congrats, included in ${targetBlockNumber}`)
        // } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        //     console.log(`Not included in ${targetBlockNumber}`)
        // } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        //     console.log(`Nonce too high, bailing`)
        // }

    }

};

main();


