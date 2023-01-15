import Router from 'koa-router';
import _ from 'lodash';
import fs from "fs";
import path from "path";
import Sequelize from 'sequelize';
import { BigNumber, ethers } from "ethers";
import { OpenseaCollections, LimitOrders } from '../dal/db';
import { HttpError } from '../model/http-error';
import { parseAddress } from '../helpers/binary_utils';
import { requireLogin, requireWhitelist } from "../helpers/auth_helper";
import { getOrders } from "../helpers/opensea/order_utils";
import { getNumberParam, getNumberQueryParam } from "../helpers/param_utils";
import { LimitOrderStatus } from '../model/limit-order-status';
const j721toolsAbi = fs.readFileSync(path.join(__dirname, '../abis/J721Tools.json')).toString();
const seaportProxyAbi = fs.readFileSync(path.join(__dirname, '../abis/SeaportProxy.json')).toString();


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
    const openseaOrders = await getOrders(openseaTokens, contract_address);
    const ordersMap = _.groupBy(openseaOrders, function (item) {
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

  const abi = [
    'function buyAssetsForEth([tuple(' +
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
    '        bytes signature) parameters)] basicOrderParameters' +
    'external payable returns (bool fulfilled)'
  ];
  const openseaIface = new ethers.utils.Interface(seaportProxyAbi)


  let value = BigNumber.from(0);
  const tradeDetails = [];
  const openseaOrders = calldatas.filter(calldata => calldata.protocol_address == process.env.SEARPORT_CONTRACTR_ADDRESS);
  if (openseaOrders.length > 0) {
    for (const order of openseaOrders) {
      const basicOrderParameters = getBasicOrderParametersFromOrder(order);
      const calldata = openseaIface.encodeFunctionData("buyAssetsForEth", [[basicOrderParameters]]);
      tradeDetails.push({ marketId: 1, value: order.current_price, tradeData: calldata });
      value = value.add(BigNumber.from(order.current_price));
    }
  }

  let j721toolsIface = new ethers.utils.Interface(j721toolsAbi);
  const data = j721toolsIface.encodeFunctionData("batchBuyWithETH", [tradeDetails]);
  ctx.body = { value: value.toString(), calldata: data };
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


  // @todo judge weth balance
  // @todo judge weth allowance

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
    ctx.status = 200;
    ctx.body = {}
  }


  const expirationTime = new Date(expiration);
  const skipFlagged = ctx.request.body['skip_flagged'];

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

const getBasicOrderParametersFromOrder = (order) => {
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

module.exports = OrdersRouter;