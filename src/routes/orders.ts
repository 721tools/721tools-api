import Router from 'koa-router';
import { gotScraping } from 'got-scraping';
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
  }
  if (tokens.length > 50) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.TOO_MANY_TOKENS]
    }
  }

  const openseaTokens = tokens.filter(token => token.platform == 0);
  if (openseaTokens.length > 0) {
    let url = `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/orders/${process.env.NETWORK === 'goerli' ? "goerli" : "ethereum"}/seaport/listings?asset_contract_address=0x${Buffer.from(collection.contract_address, 'binary').toString('hex')}&limit=50&order_by=eth_price&order_direction=asc&format=json`;
    for (const openseaToken of openseaTokens) {
      url = url + "&token_ids=" + openseaToken.token_id;
    }
    const key = randomKey();
    console.log(key);
    const response = await gotScraping({
      url: url,
      headers: {
        'content-type': 'application/json',
        'X-API-KEY': key
      },
    });
    if (response.statusCode != 200) {
      console.log(`Get opensea listings error, using key:${key}, url:${url}`, response.body);
      ctx.status = 500;
      ctx.body = {
        error: HttpError[HttpError.OEPNSEA_ERROR]
      }
      return;
    }
    const orders = JSON.parse(response.body).orders;
    if (!orders || orders.length < 1) {
      console.log(`Get no opensea listings ${url}`, response.body);
      ctx.status = 500;
      ctx.body = {
        error: HttpError[HttpError.OEPNSEA_ERROR]
      }
      return;
    }
  }

  ctx.body = ctx.request.body;
});


module.exports = OrdersRouter;