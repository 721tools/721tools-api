import Router from 'koa-router';
import { OpenseaCollections, SmartBuys } from '../dal/db';
import { HttpError } from '../model/http-error';
import { SmartBuyStatus } from '../model/smart-buy-status';
import { requireWhitelist } from "../helpers/auth_helper"
import { id } from 'ethers/lib/utils';

const SmartBuysRouter = new Router({})

SmartBuysRouter.post('/', requireWhitelist, async (ctx) => {
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
    return;
  }

  const expirationTime = new Date(expiration);

  await SmartBuys.create({
    user_id: user.id,
    slug: slug,
    contract_address: collection.contract_address,
    min_rank: getNumberParam('min_rank', ctx),
    max_rank: getNumberParam('max_rank', ctx),
    amount: amount,
    price: price,
    expiration_time: expirationTime,
    status: SmartBuyStatus[SmartBuyStatus.INIT],
    traits: ctx.request.body['traits'],
    token_ids: ctx.request.body['token_ids'],
  });
  ctx.body = {}
});



SmartBuysRouter.put('/:id/start', requireWhitelist, async (ctx) => {
  const user = ctx.session.siwe.user;
  const smartBuy = await SmartBuys.findOne({
    id: id,
    user_id: user.id
  });
  if (!smartBuy) {
    ctx.status = 404;
    ctx.body = {
      error: HttpError[HttpError.SMART_BUY_NOT_FOUND]
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


SmartBuysRouter.get('/', requireWhitelist, async (ctx) => {
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