import Router from 'koa-router';
import { ethers } from "ethers";
import Sequelize from 'sequelize';
import { OpenseaCollections, SmartBuys, OpenseaItems } from '../dal/db';
import { HttpError } from '../model/http-error';
import { SmartBuyStatus } from '../model/smart-buy-status';
import { requireLogin, requireWhitelist } from "../helpers/auth_helper"
import _ from 'lodash';

const SmartBuysRouter = new Router({})

const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'rinkeby' ? process.env.RINKEBY_RPC_URL : process.env.ETH_RPC_URL);

SmartBuysRouter.post('/', requireLogin, requireWhitelist, async (ctx) => {
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

  const min_rank = getNumberParam('min_rank', ctx);
  const max_rank = getNumberParam('max_rank', ctx);
  if (max_rank > min_rank) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.MIN_RANK_MUST_BIGGER_THAN_MAX_RANK]
    }
    return;
  }

  const expirationTime = new Date(expiration);

  await SmartBuys.create({
    user_id: user.id,
    slug: slug,
    contract_address: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
    min_rank: min_rank,
    max_rank: max_rank,
    amount: amount,
    price: price,
    expiration_time: expirationTime,
    status: SmartBuyStatus[SmartBuyStatus.INIT],
    traits: ctx.request.body['traits'],
    token_ids: JSON.stringify(ctx.request.body['token_ids']),
    block_height: await provider.getBlockNumber(),
  });
  ctx.body = {}
});



SmartBuysRouter.post('/tokens', requireLogin, requireWhitelist, async (ctx) => {
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

  let page = getNumberQueryParam('page', ctx);
  if (page <= 0) {
    page = 1;
  }

  let limit = getNumberQueryParam('limit', ctx);
  if (limit <= 0) {
    limit = 20;
  }
  if (limit > 20) {
    limit = 20;
  }

  const min_rank = getNumberParam('min_rank', ctx);
  const max_rank = getNumberParam('max_rank', ctx);
  const traits = ctx.request.body['traits'];

  if (min_rank == 0 || max_rank == 0) {
    if (_.isEmpty(traits)) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.MUST_HAVE_RANK_OR_TRAITS]
      }
    }
  }

  if (max_rank > min_rank) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.MIN_RANK_MUST_BIGGER_THAN_MAX_RANK]
    }
    return;
  }

  const itemsCount = await OpenseaItems.count({
    where: {
      contract_address: collection.contract_address,
      traits_rank: {
        [Sequelize.Op.gt]: 0
      },
    },
  });
  if (itemsCount < collection.total_supply) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.COLLECTION_SYNC_NOT_FINISHED]
    }
    return;
  }

  let rows = [], count = 0;

  const order = (min_rank > 0 || max_rank > 0) ? [['traits_score', 'DESC']] : [['id', 'ASC']];
  const where = (min_rank > 0 || max_rank > 0) ? {
    contract_address: collection.contract_address,
    traits_rank: {
      [Sequelize.Op.gte]: max_rank,
      [Sequelize.Op.lte]: min_rank
    }
  } : {
    contract_address: collection.contract_address,
  };

  if (_.isEmpty(traits)) {
    const res = await OpenseaItems.findAndCountAll({
      where: where,
      offset: (page.valueOf() - 1) * limit.valueOf(),
      limit: limit,
      order: order
    });
    count = res.count;
    rows = res.rows;
  } else {
    const items = await OpenseaItems.findAll({
      where: where,
      order: order
    });
    if (items.length > 0) {
      for (const item of items) {
        if (_.isEmpty(item.traits)) {
          continue;
        }
        const traitsMap = _.groupBy(item.traits, function (item) {
          return item.trait_type;
        });

        let allContains = true;
        for (const traitType of Object.keys(traits)) {
          let traitContains = false;
          if (traitType in traitsMap) {
            const traitValues = traitsMap[traitType].map(trait => {
              return trait.value
            });
            for (const traitValue of traits[traitType]) {
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
          rows.push(item);
        }
      }
      count = rows.length;

      if (count > limit) {
        rows = rows.slice((page.valueOf() - 1) * limit.valueOf(), (page.valueOf() - 1) * limit.valueOf() + limit);
      }
    }
  }


  ctx.body = {
    page: page,
    limit: limit,
    total: count,
    data: rows.map(item => {
      return {
        token_id: parseInt(item.token_id.toString("hex"), 16),
        name: item.name,
        image_url: item.image_url,
        traits_score: item.traits_score,
        traits_rank: item.traits_rank,
      }
    })
  }
});


SmartBuysRouter.put('/:id/start', requireLogin, requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;
  const smartBuy = await SmartBuys.findOne({
    id: ctx.params.id,
    user_id: user.id
  });
  if (!smartBuy) {
    ctx.status = 404;
    ctx.body = {
      error: HttpError[HttpError.SMART_BUY_NOT_FOUND]
    }
    return;
  }
  if (smartBuy.status == SmartBuyStatus[SmartBuyStatus.FINISHED]) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.SMART_BUY_FINISHED]
    }
    return;
  }

  await smartBuy.update({
    status: SmartBuyStatus[SmartBuyStatus.RUNNING],
    error_code: "",
    error_details: ""
  });
  ctx.body = {}
});

SmartBuysRouter.put('/:id/stop', requireLogin, requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;
  const smartBuy = await SmartBuys.findOne({
    id: ctx.params.id,
    user_id: user.id
  });
  if (!smartBuy) {
    ctx.status = 404;
    ctx.body = {
      error: HttpError[HttpError.SMART_BUY_NOT_FOUND]
    }
    return;
  }
  if (smartBuy.status == SmartBuyStatus[SmartBuyStatus.FINISHED]) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.SMART_BUY_FINISHED]
    }
    return;
  }

  await smartBuy.update({
    status: SmartBuyStatus[SmartBuyStatus.PAUSED],
    error_code: "",
    error_details: ""
  });
  ctx.body = {}
});

const getNumberParam = (param, ctx) => {
  let paramValue: number = 0;
  if (param in ctx.request.body) {
    paramValue = Number(ctx.request.body[param]);
    if (paramValue < 0) {
      paramValue = 0;
    }
  }
  return paramValue;
};

const getNumberQueryParam = (param, ctx) => {
  let paramValue: number = 0;
  if (param in ctx.request.query) {
    paramValue = Number(ctx.request.query[param]);
    if (paramValue < 0) {
      paramValue = 0;
    }
  }
  return paramValue;
};


SmartBuysRouter.get('/', requireLogin, requireWhitelist, async (ctx) => {
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

  const { rows, count } = await SmartBuys.findAndCountAll({
    where: {
      user_id: user.id
    },
    offset: (page.valueOf() - 1) * limit.valueOf(),
    limit: limit,
    order: [['id', 'ASC']]
  });
  ctx.body = {
    page: page,
    limit: limit,
    total: count,
    data: rows.map(smartBuy => {
      return {
        id: smartBuy.id,
        slug: smartBuy.slug,
        min_rank: smartBuy.min_rank,
        max_rank: smartBuy.max_rank,
        traits: smartBuy.traits,
        token_ids: smartBuy.token_ids,
        price: smartBuy.price,
        amount: smartBuy.amount,
        purchased: smartBuy.purchased,
        status: smartBuy.status,
        error_code: smartBuy.error_code,
        error_details: smartBuy.error_details,
        expiration_time: smartBuy.expiration_time.getTime(),
        create_time: smartBuy.create_time.getTime(),
        update_time: smartBuy.update_time.getTime()
      }
    })
  }
});


module.exports = SmartBuysRouter;