import Router from 'koa-router';
import { gotScraping } from 'got-scraping';
import { ethers } from "ethers";
import { OpenseaCollections } from '../dal/db';
import { HttpError } from '../model/http-error';
import { parseAddress } from '../helpers/binary_utils';
import { randomKey } from '../helpers/opensea/key_utils';
import { requireLogin } from "../helpers/auth_helper";
import _ from 'lodash';

const OrdersRouter = new Router({})

// OrdersRouter.post('/sweep', requireLogin, async (ctx) => {
OrdersRouter.post('/sweep', async (ctx) => {
  if (!('contract_address' in ctx.request.body)) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }
  const contract_address = ctx.request.body['contract_address'];
  if (!contract_address) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }

  const collection = await OpenseaCollections.findOne({
    where: {
      contract_address: parseAddress(contract_address)
    }
  });

  if (!collection) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }
  if (collection.status == 1) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }

  const tokens = ctx.request.body['tokens'];
  if (!tokens || tokens.length == 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.EMPTY_TOKENS]
    }
    return;
  }
  if (tokens.length > 50) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.TOO_MANY_TOKENS]
    }
    return;
  }

  const openseaTokens = tokens.filter(token => token.platform == 0);
  const missingTokens = [];
  const calldatas = [];
  if (openseaTokens.length > 0) {
    let url = `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/orders/${process.env.NETWORK === 'goerli' ? "goerli" : "ethereum"}/seaport/listings?asset_contract_address=0x${Buffer.from(collection.contract_address, 'binary').toString('hex')}&limit=50&order_by=eth_price&order_direction=asc&format=json`;
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
        ctx.status = 500;
        ctx.body = {
          error: HttpError[HttpError.OEPNSEA_ERROR]
        }
        return;
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
    const ordersMap = _.groupBy(allOrders, function (item) {
      return item.maker_asset_bundle.assets[0].token_id;
    });
    for (const openseaToken of openseaTokens) {
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

      calldatas.push(order);
    }
  }
  if (missingTokens.length > 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.ORDER_EXPIRED],
      order_ids: missingTokens
    }
    return;
  }

  ctx.body = calldatas;
});


module.exports = OrdersRouter;