import { gotScraping } from 'got-scraping';
import { BigNumber, ethers, utils } from "ethers";
import _ from 'lodash';
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import fs from "fs";
import path from "path";
import Sequelize from 'sequelize';

import { Orders, OrderBuyLogs } from '../dal/db';

import { randomKey } from './opensea/key_utils';
import { HttpError } from '../model/http-error';
import { Flatform } from '../model/platform';
import { OrderType } from '../model/order-type';
import { BuyStatus } from '../model/buy-status';
import { parseTokenId, parseAddress } from "./binary_utils";
import { MARKETS, getPlatform } from "./protocol_utils";

import { decode, parseCalldata } from "./blur_utils";
import { getWethAddress } from '../helpers/opensea/erc20_utils';
import { estimateFees } from '../helpers/layer_zero_utils';

const seaportProxyAbi = fs.readFileSync(path.join(__dirname, '../abis/SeaportProxy.json')).toString();
const seaportProxyIface = new ethers.utils.Interface(seaportProxyAbi);
const j721toolsAbi = fs.readFileSync(path.join(__dirname, '../abis/J721Tools.json')).toString();
const j721toolsIface = new ethers.utils.Interface(j721toolsAbi);
const multicall3Abi = fs.readFileSync(path.join(__dirname, '../abis/Multicall3.json')).toString();
const erc721Abi = fs.readFileSync(path.join(__dirname, '../abis/ERC721.json')).toString();

const seaportAbi = [
    'function fulfillBasicOrder(tuple(address considerationToken, uint256 considerationIdentifier, uint256 considerationAmount, address offerer, address zone, address offerToken, uint256 offerIdentifier, uint256 offerAmount, uint8 basicOrderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 offererConduitKey, bytes32 fulfillerConduitKey, uint256 totalOriginalAdditionalRecipients, tuple(uint256 amount, address recipient)[] additionalRecipients, bytes signature) parameters) payable returns (bool fulfilled)',
]
const seaportIface = new ethers.utils.Interface(seaportAbi);

export const getOpenseaOrders = async (openseaTokens, contractAddress) => {
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
                'X-API-KEY': process.env.NETWORK === 'goerli' ? "" : key
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
    if (allOrders.length > 0) {
        const result = [];
        for (const order of allOrders) {
            const params = await getBasicOrderParametersFromOrder(order, key);
            if (!params) {
                return [];
            }
            result.push({
                protocol_address: order.protocol_address,
                order: params
            });
        }
        return result;
    }
    return allOrders;
}


export const getCalldata = async (tokens, contractAddress, userAddress, l2ChainAddress, blurAuthToken) => {
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
            return result;
        }
        const tokenPrices = _.map(blurTokens, (item) => {
            return {
                tokenId: item.token_id.toString(),
                price: {
                    amount: item.price.toString(),
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
        if (response.statusCode != 201) {
            result.success = false;
            result.message = HttpError[HttpError.GET_BLUR_CALLDATA_ERROR];
            console.log(`Get blur calldata failed, tokens:${JSON.stringify(tokenPrices)}, response: ${response.body}`);
            return result;
        }
        const responseBody = JSON.parse(response.body);
        if (!responseBody.success) {
            console.log(`Get blur calldata failed, tokens:${JSON.stringify(tokenPrices)}, response: ${response.body}`);
            result.success = false;
            result.message = HttpError[HttpError.GET_BLUR_CALLDATA_ERROR];
            return result;
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

        tradeDetails.push({ marketId: l2ChainAddress ? MARKETS["Blur"].ethereum_cross_platform : MARKETS["Blur"].ethereum_platform, value: totalPrice, tradeData: parseCalldata(blurTxnData) });
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
        for (const token of openseaTokens) {
            openseaTokenFilters.push({
                token_id: parseTokenId(token.token_id),
                price: { [Sequelize.Op.lte]: parseFloat(token.price.toString()) }
            });
        }

        const ordersInDb = await Orders.findAll({
            where: {
                contract_address: parseAddress(contractAddress),
                status: 1,
                type: OrderType.AUCTION_CREATED,
                order_expiration_date: {
                    [Sequelize.Op.gt]: new Date()
                },
                calldata: {
                    [Sequelize.Op.ne]: null
                },
                [Sequelize.Op.or]: openseaTokenFilters
            },
        });

        if (ordersInDb.length > 0) {
            for (const order of ordersInDb) {
                const tokenId = parseInt(order.token_id.toString("hex"), 16);
                if (!order.protocol_address) {
                    missingTokens.push(tokenId.toString())
                    result.success = false;
                    result.message = HttpError[HttpError.ORDER_EXPIRED];
                    return result;
                }
                const protocol_address = ethers.utils.getAddress('0x' + Buffer.from(order.protocol_address, 'binary').toString('hex'));

                const platform = getPlatform(protocol_address, process.env.NETWORK, l2ChainAddress);
                if (platform == 0) {
                    missingTokens.push(tokenId.toString())
                    result.success = false;
                    result.message = HttpError[HttpError.PROTOCAL_NOT_SUPPORTED];
                    return result;
                }

                orders.seaport.db.push({ price: ethers.utils.parseUnits(order.price.toString(), "ether"), token_id: tokenId, calldata: order.calldata, platform: platform });
                for (const index in openseaLeftTokens) {
                    if (openseaLeftTokens[index].token_id.toString() == tokenId.toString()) {
                        openseaLeftTokens.splice(index);
                    }
                }
            }
        }

        if (openseaLeftTokens.length > 0) {
            const openseaOrders = openseaLeftTokens.length > 0 ? await getOpenseaOrders(openseaLeftTokens, contractAddress) : [];
            if (openseaOrders.length == 0) {
                result.success = false;
                result.message = HttpError[HttpError.ORDER_EXPIRED];
                result.missing_tokens = _.map(openseaLeftTokens, (item) => item.token_id.toString());
                return result;
            }
            const ordersMap = _.groupBy(openseaOrders, function (item) {
                return item.order.offerIdentifier;
            });
            for (const openseaToken of openseaLeftTokens) {
                if (!(openseaToken.token_id.toString() in ordersMap)) {
                    missingTokens.push(openseaToken.token_id.toString())
                    continue;
                }

                const order = ordersMap[openseaToken.token_id.toString()][0].order;
                const orderAssetContract = order.considerationToken;
                const considerationIdentifier = order.considerationIdentifier;
                if (orderAssetContract !== "0x0000000000000000000000000000000000000000" || considerationIdentifier !== "0") {
                    missingTokens.push(openseaToken.token_id.toString());
                    continue;
                }
                let currentPrice = BigNumber.from(order.considerationAmount);
                for (const additionalRecipient of order.additionalRecipients) {
                    currentPrice = currentPrice.add(BigNumber.from(additionalRecipient.amount));
                }
                if (currentPrice.gt(ethers.utils.parseEther(openseaToken.price.toString()))) {
                    missingTokens.push(openseaToken.token_id.toString());
                    continue;
                }

                orders.seaport.remote.push({
                    protocol_address: ordersMap[openseaToken.token_id.toString()][0].protocol_address,
                    order: order
                });

                for (const index in openseaLeftTokens) {
                    if (openseaLeftTokens[index].token_id.toString() == openseaToken.token_id.toString()) {
                        openseaLeftTokens.splice(index);
                    }
                }
            }
        }

        if (openseaLeftTokens.length > 0) {
            for (const openseaToken of openseaLeftTokens) {
                missingTokens.push(openseaToken.token_id.toString());
            }
        }
    }


    if (missingTokens.length > 0) {
        result.success = false;
        result.message = HttpError[HttpError.ORDER_EXPIRED];
        result.missing_tokens = missingTokens;
        return result;
    }



    if (orders.seaport.db.length > 0) {
        for (const order of orders.seaport.db) {
            const seaportOrder = seaportIface.decodeFunctionData("fulfillBasicOrder", order.calldata);
            const calldata = seaportProxyIface.encodeFunctionData("buyAssetsForEth", [[seaportOrder.parameters]]);
            tradeDetails.push({ marketId: order.platform, value: order.price, tradeData: calldata });
            result.value = result.value.add(order.price);
        }
    }
    if (orders.seaport.remote.length > 0) {
        for (const orderAndProtocal of orders.seaport.remote) {
            const order = orderAndProtocal.order;
            const calldata = seaportProxyIface.encodeFunctionData("buyAssetsForEth", [[order]]);
            let currentPrice = BigNumber.from(order.considerationAmount);
            for (const additionalRecipient of order.additionalRecipients) {
                currentPrice = currentPrice.add(BigNumber.from(additionalRecipient.amount));
            }
            const protocol_address = ethers.utils.getAddress(orderAndProtocal.protocol_address);
            const platform = getPlatform(protocol_address, process.env.NETWORK, l2ChainAddress);
            if (platform == 0) {
                missingTokens.push(order.offerIdentifier)
                result.success = false;
                result.message = HttpError[HttpError.PROTOCAL_NOT_SUPPORTED];
                return result;
            }
            tradeDetails.push({ marketId: platform, value: currentPrice, tradeData: calldata });
            result.value = result.value.add(currentPrice);
        }
    }
    if (l2ChainAddress) {
        const crossChainFee = await estimateFees(process.env.X_CONTRACT_ADDRESS, ethers.utils.solidityPack(
            ["uint16", "address", "address", "uint256", "address"],
            [1, contractAddress, l2ChainAddress, tokens[0].token_id, userAddress]
        ))
        result.value = result.value.add(crossChainFee.mul(tokens.length));
    }

    const data = j721toolsIface.encodeFunctionData("batchBuyWithETH", [tradeDetails]);
    result.calldata = data;
    return result;
}


export const getFillOrderCalldata = async (limitOrder, address, tokenId) => {
    let index = 0;
    const tokenIds = limitOrder.token_ids;
    if (null != tokenIds && tokenIds.length > 0) {
        if (tokenIds.includes(tokenId)) {
            index = tokenIds.indexOf(tokenId);
        }
    }

    const calldata = j721toolsIface.encodeFunctionData("fillOrder", [
        [
            address, limitOrder.contract_address, limitOrder.nonce, getWethAddress(), limitOrder.amount,
            ethers.utils.parseUnits(limitOrder.price.toString(), "ether"),
            limitOrder.expiration_time.getTime(),
            limitOrder.token_ids,
            limitOrder.salt
        ],
        limitOrder.signature, tokenId, index]);
    return calldata;
}




export const getBasicOrderParametersFromOrder = async (order, openseaKey) => {
    if (process.env.NETWORK === 'goerli') {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const request = {
        listing: {
            hash: order.order_hash,
            chain: order.maker_asset_bundle.assets[0].asset_contract.chain_identifier,
            protocol_address: order.protocol_address,
        },
        fulfiller: {
            address: process.env.CONTRACT_ADDRESS
        }
    };
    const response = await gotScraping({
        url: `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/listings/fulfillment_data`,
        method: 'POST',
        body: JSON.stringify(request),
        headers: {
            'content-type': 'application/json',
            'X-API-KEY': process.env.NETWORK === 'goerli' ? "" : openseaKey
        },
    });
    if (response.statusCode != 200) {
        console.log(`Fullfile order, failed, listing:${JSON.stringify(request.listing)}, response: ${response.body}`);
        return null;
    }
    const responseBody = JSON.parse(response.body);
    return responseBody.fulfillment_data.transaction.input_data.parameters;
}


export const buy = async (provider, user, limitOrder, contractAddress, tokens, blurAuthToken) => {
    const signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    const callDataResult = await getCalldata(tokens, contractAddress, signer.address, null, blurAuthToken);
    if (!callDataResult.success) {
        console.error(`Address ${signer.address} buy limit order ${limitOrder.id} failed, not calldata found`);
        return;
    }

    const currentPrice = parseFloat(ethers.utils.formatUnits(callDataResult.value, 'ether'));

    const profit = limitOrder.price - currentPrice;

    if (profit <= 0.01) {
        console.error(`Address ${signer.address} buy limit order ${limitOrder.id} failed, profit ${profit}`);
        return;
    }
    const gasLimit = await signer.estimateGas({
        to: process.env.CONTRACT_ADDRESS,
        data: callDataResult.calldata,
        value: callDataResult.value
    });
    const feeData = await provider.getFeeData();

    const totalGas = parseFloat(ethers.utils.formatUnits(gasLimit.mul(feeData.gasPrice), 'ether')) * 3;

    if (totalGas > profit) {
        console.error(`Address ${signer.address} buy limit order ${limitOrder.id} failed, gas ${totalGas} too high`);
        return;
    }

    if (totalGas > profit + 0.01) {
        console.error(`Address ${signer.address} buy limit order ${limitOrder.id} failed, profit ${profit}`);
        return;
    }

    const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(signer.address)));
    if (balance < (totalGas + currentPrice)) {
        console.error(`Address ${signer.address} buy limit order ${limitOrder.id} failed, balance ${balance}`);
        return;
    }


    const calls = [];
    calls.push([process.env.CONTRACT_ADDRESS, false, callDataResult.value, callDataResult.calldata]);

    const erc721Contract = new ethers.Contract(contractAddress, erc721Abi, signer);
    const isApproved = await erc721Contract.isApprovedForAll(process.env.MULTICALL_CONTRACT_ADDRESS, process.env.CONTRACT_ADDRESS);
    if (!isApproved) {
        calls.push([contractAddress, false, 0, erc721Contract.interface.encodeFunctionData("setApprovalForAll", [process.env.CONTRACT_ADDRESS, true])]);
    }

    for (const token of tokens) {
        calls.push([process.env.CONTRACT_ADDRESS, false, 0, await getFillOrderCalldata(limitOrder, user.address, token.token_id)]);
    }

    const wethIface = new utils.Interface([
        'function approve(address spender, uint256 amount) public returns (bool)',
        'function withdraw(uint256 wad) public',
        'function transferFrom(address src, address dst, uint256 wad) public',
        'function transfer(address dst, uint256 wad) public'
    ]);

    const withdrawWethCalldata = wethIface.encodeFunctionData("withdraw", [ethers.utils.parseEther(limitOrder.price.toString())]);
    calls.push([getWethAddress(), false, 0, withdrawWethCalldata]);
    calls.push([signer.address, false, ethers.utils.parseEther(limitOrder.price.toString()), "0x00"]);

    // 1: batchBuyWithETH 
    // 2: Approve NFT
    // 3: fillOrder
    // 4: Unwrap WETH
    // 5: Transfer ETH Back

    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, signer,
        process.env.NETWORK === 'goerli' ? "https://relay-goerli.flashbots.net" : "https://relay.flashbots.net"
    );

    const contract = new ethers.Contract(process.env.MULTICALL_CONTRACT_ADDRESS, multicall3Abi, signer);
    const transaction = await contract.populateTransaction.aggregate3Value(calls, {
        value: callDataResult.value
    })

    // try {
    // const tx = await contract.aggregate3Value(calls, { value: callDataResult.value });
    // } catch (error) {
    //     console.error(`Address ${signer.address} buy limit order ${limitOrder.id} failed`, error)
    // }

    // console.log(`Address ${signer.address} buy limit order ${limitOrder.id} success with tx ${tx.hash}`)

    transaction.chainId = process.env.NETWORK === 'goerli' ? 5 : 1;
    const baseFee = (await provider.getBlock("latest")).baseFeePerGas as BigNumber;
    transaction.gasPrice = baseFee.mul(11).div(10);
    const signedTransactions = await flashbotsProvider.signBundle([{
        transaction,
        signer: signer
    }]);
    const currentBlockNumber = await provider.getBlockNumber();
    const BLOCKS_IN_FUTURE = 1;
    const targetBlockNumber = currentBlockNumber + BLOCKS_IN_FUTURE;

    const simulation = await flashbotsProvider.simulate(
        signedTransactions,
        targetBlockNumber
    );

    // 检查模拟是否成功
    if ("error" in simulation) {
        console.log(`Address ${signer.address} buy limit order ${limitOrder.id} error, flashbots error: ${simulation.error.message}`);
        return;
    }

    const TRY_BLOCKS = 15;
    for (let i = 0; i <= TRY_BLOCKS; i++) {
        const blockNumber = targetBlockNumber + i;
        const bundleResponse = await flashbotsProvider.sendRawBundle(signedTransactions, blockNumber);
        if ('error' in bundleResponse) {
            console.log(`Address ${signer.address} buy limit order ${limitOrder.id} error, flashbots error: ${bundleResponse.error.message}`)
            return;
        }
        const bundleResolution = await bundleResponse.wait();
        if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
            const tx = simulation.results[0].txHash;
            for (const token of tokens) {
                await OrderBuyLogs.create({
                    user_id: user.id,
                    contract_address: contractAddress,
                    order_id: limitOrder.id,
                    tx: tx,
                    price: token.price,
                    token_id: token.token_id,
                    status: BuyStatus[BuyStatus.RUNNING],
                });
            }
            console.log(`Address ${signer.address} buy limit order ${limitOrder.id} success with tx ${tx}`)
            return;
        } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
            console.log(`Not included in ${blockNumber}`);
            // console.log(`Address ${signer.address} buy limit order ${limitOrder.id} error, flashbots error: Not included in ${targetBlockNumber}`);
        } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
            console.log(`Address ${signer.address} buy limit order ${limitOrder.id} error, flashbots error: Nonce too high, bailing`)
            return;
        }
    }

    console.log(`Address ${signer.address} buy limit order ${limitOrder.id} failed, not included by flashbots`)


};
