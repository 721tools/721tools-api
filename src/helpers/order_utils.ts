import { gotScraping } from 'got-scraping';
import { BigNumber, ethers, utils } from "ethers";
import _ from 'lodash';
import fs from "fs";
import path from "path";
import Sequelize from 'sequelize';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

import { Orders, OrderBuyLogs } from '../dal/db';

import { randomKey } from './opensea/key_utils';
import { HttpError } from '../model/http-error';
import { Flatform } from '../model/platform';
import { OrderType } from '../model/order-type';
import { BuyStatus } from '../model/buy-status';
import { parseTokenId, parseAddress } from "./binary_utils";
import { decode, parseCalldata } from "./blur_utils";
import { getWethAddress } from '../helpers/opensea/erc20_utils';

const seaportProxyAbi = fs.readFileSync(path.join(__dirname, '../abis/SeaportProxy.json')).toString();
const j721toolsAbi = fs.readFileSync(path.join(__dirname, '../abis/J721Tools.json')).toString();

export const getOrders = async (openseaTokens, contractAddress) => {
    let url = `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/orders/${process.env.NETWORK === 'goerli' ? "goerli" : "ethereum"}/seaport/listings?asset_contract_address=${contractAddress}&limit=50&order_by=eth_price&order_direction=asc&format=json`;
    for (const openseaToken of openseaTokens) {
        url = url + "&token_ids=" + openseaToken.token_id;
    }
    const key = randomKey();
    let hasMore = true;
    let cursor = null;
    let allOrders = [];
    while (hasMore) {
        const requestUrl = cursor ? url + `&cursor=${cursor}` : url;
        const response = await gotScraping({
            url: requestUrl,
            headers: {
                'content-type': 'application/json',
                'X-API-KEY': key
            },
        });
        if (response.statusCode != 200) {
            console.log(`Get opensea listings error, using key:${key}, url:${requestUrl}`, response.body);
            return [];
        }
        const responseBody = JSON.parse(response.body);
        const orders = responseBody.orders;
        cursor = responseBody.next;
        if (!cursor) {
            hasMore = false;
        }
        if (orders.length > 0) {
            allOrders = allOrders.concat(orders);
        }
    }
    return allOrders;
}


export const getCalldata = async (tokens, contractAddress, userAddress, blurAuthToken) => {
    const result = {
        success: true,
        message: "",
        value: BigNumber.from(0),
        missing_tokens: [],
        calldata: "0x"
    }

    if (!tokens || tokens.length == 0) {
        result.success = false;
        result.message = HttpError[HttpError.EMPTY_TOKENS];
        return result;
    }
    if (tokens.length > 50) {
        result.success = false;
        result.message = HttpError[HttpError.TOO_MANY_TOKENS];
        return result;
    }
    const tradeDetails = [];

    const blurTokens = tokens.filter(token => token.platform == Flatform.BLUR);
    if (blurTokens.length > 0) {
        if (!blurAuthToken) {
            result.success = false;
            result.message = HttpError[HttpError.EMPTY_BLUR_AUTH_TOKEN];
            return;
        }
        const tokenPrices = _.map(blurTokens, (item) => {
            return {
                tokenId: item.token_id,
                price: {
                    amount: item.price,
                    unit: "ETH"
                }
            }
        });
        const response = await gotScraping({
            url: `https://core-api.prod.blur.io/v1/buy/${contractAddress}`,
            body: JSON.stringify({
                tokenPrices: tokenPrices,
                userAddress: userAddress
            }),
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'cookie': `authToken=${blurAuthToken}; walletAddress=${userAddress}`,
            },
        });
        if (response.statusCode != 200) {
            result.success = false;
            result.message = HttpError[HttpError.GET_BLUR_CALLDATA_ERROR];
            console.log(`Get blur calldata failed, tokens:${JSON.stringify(tokenPrices)}, response: ${response.body}`);
            return;
        }
        const responseBody = JSON.parse(response.body);
        if (!responseBody.success) {
            console.log(`Get blur calldata failed, tokens:${JSON.stringify(tokenPrices)}, response: ${response.body}`);
            result.success = false;
            result.message = HttpError[HttpError.GET_BLUR_CALLDATA_ERROR];
            return;
        }
        const blurResult = JSON.parse(decode(responseBody.data));
        if (blurResult.cancelReasons && blurResult.cancelReasons.length > 0) {
            result.success = false;
            result.message = HttpError[HttpError.ORDER_EXPIRED];
            result.missing_tokens = _.map(blurResult.cancelReasons, (item) => item.tokenId);
            return result;
        }

        const blurTxnData = blurResult.buys[0].txnData.data;

        const totalPrice = ethers.utils.parseEther(_.reduce(blurTokens, (memo: number, token: { price: number }) => memo + token.price, 0).toString());


        tradeDetails.push({ marketId: 10, value: totalPrice, tradeData: parseCalldata(blurTxnData) });
        result.value = result.value.add(totalPrice);
    }

    const openseaTokens = tokens.filter(token => token.platform == Flatform.OPENSEA);
    const missingTokens = [];
    const openseaLeftTokens = openseaTokens.slice();
    const orders = {
        seaport: {
            db: [],
            remote: []
        }
    };

    if (openseaTokens.length > 0) {
        let openseaTokenFilters = [];
        for (const token of tokens) {
            openseaTokenFilters.push({
                token_id: parseTokenId(token.token_id),
                price: { [Sequelize.Op.lte]: token.price }
            });
        }
        const ordersInDb = await Orders.findAll({
            where: {
                contract_address: parseAddress(contractAddress),
                type: OrderType.AUCTION_CREATED,
                calldata: {
                    [Sequelize.Op.ne]: null
                },
                [Sequelize.Op.or]: openseaTokenFilters
            },
        });
        if (ordersInDb.length > 0) {
            for (const order of ordersInDb) {
                const tokenId = parseInt(order.token_id.toString("hex"), 16);
                orders.seaport.db.push({ price: order.price, token_id: tokenId, calldata: order.calldata });

                for (const index in openseaLeftTokens) {
                    if (openseaLeftTokens[index].token_id == tokenId) {
                        openseaLeftTokens.splice(index);
                    }
                }
            }
        }

        const openseaOrders = openseaLeftTokens.length > 0 ? await getOrders(openseaLeftTokens, contractAddress) : [];

        const ordersMap = _.groupBy(openseaOrders, function (item) {
            return item.maker_asset_bundle.assets[0].token_id;
        });
        for (const openseaToken of openseaLeftTokens) {
            if (!(openseaToken.token_id in ordersMap)) {
                missingTokens.push(openseaToken.token_id)
                continue;
            }

            const order = ordersMap[openseaToken.token_id][0];
            const orderAssetContract = order.taker_asset_bundle.assets[0].asset_contract.address;
            const orderAssetsymbol = order.taker_asset_bundle.assets[0].asset_contract.symbol;
            if (orderAssetContract !== "0x0000000000000000000000000000000000000000" || orderAssetsymbol !== "ETH") {
                missingTokens.push(openseaToken.token_id);
                continue;
            }
            const current_price = parseFloat(ethers.utils.formatUnits(order.current_price, 'ether'));
            if (current_price > openseaToken.price) {
                missingTokens.push(openseaToken.token_id);
                continue;
            }

            orders.seaport.remote.push(order);
        }
    }
    if (missingTokens.length > 0) {
        result.success = false;
        result.message = HttpError[HttpError.ORDER_EXPIRED];
        result.missing_tokens = missingTokens;
        return result;
    }

    const openseaIface = new ethers.utils.Interface(seaportProxyAbi)

    if (orders.seaport.db.length > 0) {
        for (const order of orders.seaport.db) {
            const calldata = order.calldata;
            const orderValue = ethers.utils.formatEther(order.price);
            tradeDetails.push({ marketId: 10, value: orderValue, tradeData: calldata });
            result.value = result.value.add(BigNumber.from(orderValue));
        }
    }
    if (orders.seaport.remote.length > 0) {
        for (const order of orders.seaport.remote) {
            const basicOrderParameters = getBasicOrderParametersFromOrder(order);
            const calldata = openseaIface.encodeFunctionData("buyAssetsForEth", [[basicOrderParameters]]);
            tradeDetails.push({ marketId: 10, value: order.current_price, tradeData: calldata });
            result.value = result.value.add(BigNumber.from(order.current_price));
        }
    }

    let j721toolsIface = new ethers.utils.Interface(j721toolsAbi);
    const data = j721toolsIface.encodeFunctionData("batchBuyWithETH", [tradeDetails]);

    result.calldata = data;
    return result;
}


export const getFillOrderCalldata = async (limitOrder, address, tokenId) => {
    const openseaIface = new ethers.utils.Interface(seaportProxyAbi);
    let index = 0;
    const tokenIds = limitOrder.token_ids;
    if (null != tokenIds && tokenIds.length > 0) {
        if (tokenIds.includes(tokenId)) {
            index = tokenIds.indexOf(tokenId);
        }
    }

    const calldata = openseaIface.encodeFunctionData("fillOrder", [
        [
            address, limitOrder.contract_address, limitOrder.nonce, getWethAddress(), 1,
            parseFloat(ethers.utils.formatUnits(limitOrder.price, 'ether')),
            limitOrder.expiration_time.getTime(),
            limitOrder.token_ids,
            limitOrder.salt
        ],
        limitOrder.signature, tokenId, index]);
    return calldata;
}




export const getBasicOrderParametersFromOrder = (order) => {
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

const limiterFlexible = new RateLimiterMemory({
    points: 1,
    duration: 0.2,
})
const limiterQueue = new RateLimiterQueue(limiterFlexible);

export const buy = async (provider, user, limitOrder, contractAddress, tokenId, price) => {
    await limiterQueue.removeTokens(1);
    const blurAuthToken = "";
    const callDataResult = await getCalldata([{
        platform: 0,
        token_id: tokenId,
        price: price,
    }], contractAddress, user.address, blurAuthToken);

    if (!callDataResult.success) {
        return;
    }
    const data = callDataResult.calldata;

    const totalValue = BigNumber.from(0).sub(callDataResult.value);

    const currentPrice = parseFloat(ethers.utils.formatUnits(callDataResult.value, 'ether'));

    const profit = price - currentPrice;
    if (profit <= 0.01) {
        return;
    }

    const gasLimit = await provider.estimateGas({
        to: process.env.CONTRACT_ADDRESS,
        data: data,
        value: callDataResult.value
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


    const calls = [];
    calls.push([process.env.CONTRACT_ADDRESS, data, callDataResult.value]);
    calls.push([process.env.CONTRACT_ADDRESS, await getFillOrderCalldata(limitOrder, user.address, tokenId), 0]);

    const wethIface = new utils.Interface([
        'function approve(address spender, uint256 amount) public returns (bool)',
        'function withdraw(uint256 wad) public'
    ]);

    const withdrawWethCalldata = wethIface.encodeFunctionData("withdraw", [ethers.utils.parseEther(profit.toString())]);
    calls.push([getWethAddress(), withdrawWethCalldata, 0]);

    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, j721toolsAbi, signer);
    const tx = await contract.aggregate(calls, { value: totalValue });


    // 1: batchBuyWithETH 
    // 2: fillOrder
    // 3: Unwrap WETH

    await OrderBuyLogs.create({
        user_id: user.id,
        contract_address: contractAddress,
        order_id: limitOrder.id,
        tx: tx.hash,
        price: price,
        status: BuyStatus[BuyStatus.RUNNING],
    });

};
