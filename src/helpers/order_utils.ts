import { gotScraping } from 'got-scraping';
import { BigNumber, ethers } from "ethers";
import _ from 'lodash';
import fs from "fs";
import path from "path";
import Sequelize from 'sequelize';

import { Orders } from '../dal/db';
import { randomKey } from './opensea/key_utils';
import { HttpError } from '../model/http-error';
import { OrderType } from '../model/order-type';
import { parseTokenId, parseAddress } from "./binary_utils";

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


export const getCalldata = async (tokens, contractAddress) => {
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

    const openseaTokens = tokens.filter(token => token.platform == 0);
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
                    [Sequelize.Op.ne]: ""
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

    const tradeDetails = [];
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


export const getFillOrderCalldata = async (limitOrder, tokenId) => {
    const tokenIds = limitOrder.token_ids;
    if (null == tokenIds) {

    }

    const openseaIface = new ethers.utils.Interface(seaportProxyAbi)
    const calldata = openseaIface.encodeFunctionData("buyAssetsForEth", [[], limitOrder.signature,]);

    /**
     *  struct OfferOrder {
            address offerer;
            address collection;
            uint8 nonce;
            address token; // TODO: only support weth(erc20) for now
            uint8 amount;
            uint256 price;
            uint256 expiresAt;
            uint256[] tokenIds;
            string salt;
        }
     */
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
