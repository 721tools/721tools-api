import Router from 'koa-router';
import _ from 'lodash';
import fs from "fs";
import path from "path";
import Sequelize from 'sequelize';
import { ethers } from "ethers";
import { recoverTypedSignature, SignTypedDataVersion } from '@metamask/eth-sig-util';

import { OpenseaCollections, LimitOrders } from '../dal/db';
import { HttpError } from '../model/http-error';
import { parseAddress } from '../helpers/binary_utils';
import { getWethAddress } from '../helpers/opensea/erc20_utils';

import { requireLogin, requireWhitelist } from "../helpers/auth_helper";
import { getCalldata } from "../helpers/order_utils";
import { getNumberParam, getNumberQueryParam } from "../helpers/param_utils";
import { LimitOrderStatus } from '../model/limit-order-status';
import { getContractWethAllowance, getWethBalance } from '../helpers/opensea/erc20_utils';
import { getItemsByTraits } from "../helpers/item_utils";

const j721toolsAbi = fs.readFileSync(path.join(__dirname, '../abis/J721Tools.json')).toString();


const OrdersRouter = new Router({})

OrdersRouter.post('/sweep', requireLogin, requireWhitelist, async (ctx) => {
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
  const result = await getCalldata(tokens, contract_address);
  if (!result.success) {
    ctx.status = 400;

    if (result.missing_tokens.length > 0) {
      ctx.body = {
        error: HttpError[HttpError.ORDER_EXPIRED],
        order_ids: result.missing_tokens
      }
    } else {
      ctx.body = {
        error: result.message
      }
    }

    return;
  }

  ctx.body = { value: result.value, calldata: result.calldata };
});

OrdersRouter.post('/params', requireLogin, requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;
  if (!('slug' in ctx.request.body)) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }
  const slug = ctx.request.body['slug'];
  if (!slug) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }

  const collection = await OpenseaCollections.findOne({
    where: {
      slug: slug
    }
  });

  if (!collection) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }


  let amount = getNumberParam('amount', ctx);
  if (amount <= 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_AMOUNT]
    }
    return;
  }

  let price = getNumberParam('price', ctx);
  if (price <= 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_PRICE]
    }
    return;
  }

  // @todo use it as it after test
  // const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
  const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC_URL);
  const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, user.address)));
  if (wethBalance < price) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.WETH_INSUFFICIEN]
    }
    return;
  }

  const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, user.address)));
  if (wethAllowance < price) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.WETH_ALLOWANCE_INSUFFICIEN]
    }
    return;
  }

  let expiration = getNumberParam('expiration', ctx);
  if (expiration <= 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_EXPIRATION]
    }
    return;
  }
  // after 1 hour
  if (expiration < new Date().getTime() + 60 * 60 * 1000) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_EXPIRATION]
    }
    return;
  }


  const traits = ctx.request.body['traits']
  let items = await getItemsByTraits(collection, traits);
  let tokenIds = [];
  if (_.isEmpty(traits)) {
    if (items.length == 0) {
      ctx.status = 500;
      ctx.body = {
        error: HttpError[HttpError.SYNC_TOKENS_ERROR]
      }
      return;
    }
  } else {
    if (items.length == 0) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.EMPTY_TOKENS]
      }
      return;
    } else {
      tokenIds = _.map(items, (item) => item.token_id);
    }
  }

  const j721tool = new ethers.Contract(process.env.CONTRACT_ADDRESS, j721toolsAbi, provider);

  const nonce = await j721tool.nonces(user.address);

  const salt = _.times(77, () => _.random(9).toString(36)).join('');

  ctx.body = {
    offerer: user.address,
    collection: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
    nonce: nonce.toNumber(),
    token: getWethAddress(),
    amount: amount,
    price: ethers.utils.parseEther(price.toString()),
    expiresAt: expiration,
    tokenIds: tokenIds,
    salt: salt,
  }
});


OrdersRouter.get('/:id/params', requireLogin, requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;
  const limitOrder = await LimitOrders.findOne({
    id: ctx.params.id,
    user_id: user.id
  });
  if (!limitOrder) {
    ctx.status = 404;
    ctx.body = {
      error: HttpError[HttpError.LIMIT_ORDER_NOT_FOUND]
    }
    return;
  }

  ctx.body = {
    offerer: user.address,
    collection: '0x' + Buffer.from(limitOrder.contract_address, 'binary').toString('hex'),
    nonce: limitOrder.nonce,
    token: getWethAddress(),
    amount: limitOrder.amount,
    price: ethers.utils.parseEther(limitOrder.price.toString()),
    expiresAt: limitOrder.expiration_time.getTime(),
    tokenIds: limitOrder.tokenIds,
    salt: limitOrder.salt,
  }
});

OrdersRouter.post('/', requireLogin, requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;

  if (!('slug' in ctx.request.body)) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }
  const slug = ctx.request.body['slug'];
  if (!slug) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }

  const collection = await OpenseaCollections.findOne({
    where: {
      slug: slug
    }
  });

  if (!collection) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }


  let amount = getNumberParam('amount', ctx);
  if (amount <= 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_AMOUNT]
    }
    return;
  }

  let price = getNumberParam('price', ctx);
  if (price <= 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_PRICE]
    }
    return;
  }
  // @todo use it as it after test
  // const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
  const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC_URL);
  const wethBalance = parseFloat(ethers.utils.formatEther(await getWethBalance(provider, user.address)));
  if (wethBalance < price) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.WETH_INSUFFICIEN]
    }
    return;
  }

  const wethAllowance = parseFloat(ethers.utils.formatEther(await getContractWethAllowance(provider, process.env.CONTRACT_ADDRESS, user.address)));
  if (wethAllowance < price) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.WETH_ALLOWANCE_INSUFFICIEN]
    }
    return;
  }

  let expiration = getNumberParam('expiration', ctx);
  if (expiration <= 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_EXPIRATION]
    }
    return;
  }
  // after 1 hour
  if (expiration < new Date().getTime() + 60 * 60 * 1000) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_EXPIRATION]
    }
    return;
  }


  const expirationTime = new Date(expiration);
  const skipFlagged = ctx.request.body['skip_flagged'];
  const tokenIds = ctx.request.body['tokenIds'];
  const nonce = ctx.request.body['nonce'];
  const salt = ctx.request.body['salt'];
  const signature = ctx.request.body['signature'];
  const msgParams = JSON.stringify({
    domain: {
      chainId: process.env.NETWORK === 'goerli' ? 5 : 1,
      name: 'Limit Order',
      verifyingContract: process.env.CONTRACT_ADDRESS,
      version: '1',
    },
    message: {
      offerer: user.address,
      collection: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
      nonce: nonce,
      token: getWethAddress(),
      amount: amount,
      price: ethers.utils.parseEther(price.toString()),
      expiresAt: expiration,
      tokenIds: tokenIds,
      salt: salt,
    },
    primaryType: 'Order',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Order: [
        { name: "offerer", type: "address" },
        { name: "collection", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "expiresAt", type: "uint256" },
        { name: "tokenIds", type: "uint256[]" },
        { name: "salt", type: "string" },
      ],
    },
  });
  const restored = recoverTypedSignature({
    data: JSON.parse(msgParams),
    signature: signature,
    version: SignTypedDataVersion.V4,
  });

  if (ethers.utils.getAddress(restored) !== ethers.utils.getAddress(user.address)) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_EXPIRATION]
    }
    ctx.body = {}
    return;
  }

  await LimitOrders.create({
    user_id: user.id,
    slug: slug,
    contract_address: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
    amount: amount,
    price: price,
    expiration_time: expirationTime,
    skip_flagged: skipFlagged,
    status: LimitOrderStatus[LimitOrderStatus.INIT],
    traits: ctx.request.body['traits'],
    token_ids: tokenIds,
    nonce: nonce,
    salt: salt,
    signature: signature,
  });
  ctx.body = {}
});


OrdersRouter.get('/', requireLogin, requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;

  let page = getNumberQueryParam('page', ctx);
  if (page <= 0) {
    page = 1;
  }

  let limit = getNumberQueryParam('limit', ctx);
  if (limit <= 0) {
    limit = 10;
  }
  if (limit > 20) {
    limit = 20;
  }

  const { rows, count } = await LimitOrders.findAndCountAll({
    where: {
      user_id: user.id
    },
    offset: (page.valueOf() - 1) * limit.valueOf(),
    limit: limit,
    order: [Sequelize.literal(`Field(status, 'INIT', 'RUNNING', 'WETH_NOT_ENOUGH', 'WETH_ALLOWANCE_NOT_ENOUGH', 'EXPIRED', 'FINISHED')`), ['id', 'DESC']]
  });
  ctx.body = {
    page: page,
    limit: limit,
    total: count,
    data: rows.map(order => {
      return {
        id: order.id,
        slug: order.slug,
        traits: order.traits,
        skip_flagged: order.skip_flagged,
        price: order.price,
        amount: order.amount,
        purchased: order.purchased,
        status: order.status,
        error_details: order.error_details,
        expiration_time: order.expiration_time.getTime(),
        create_time: order.create_time.getTime(),
        update_time: order.update_time.getTime()
      }
    })
  }
});

module.exports = OrdersRouter;