import Router from 'koa-router';
import Sequelize from 'sequelize';
import { ethers } from 'ethers';
import { gotScraping } from 'got-scraping';

import _ from 'underscore';
import { OpenseaCollections } from '../dal/db';
import { HttpError } from '../model/http-error';

const CollectionsRouter = new Router({})

CollectionsRouter.get('/', async (ctx) => {
  let page = getNumberQueryParam('page', ctx);
  if (page <= 0) {
    page = 1;
  }

  let limit = getNumberQueryParam('limit', ctx);
  if (limit <= 0) {
    limit = 10;
  }
  if (limit > 50) {
    limit = 50;
  }

  let name = "";
  if ('name' in ctx.request.query) {
    name = ctx.request.query['name'];
  }

  let criteria = {};
  if (name) {
    criteria = {
      [Sequelize.Op.or]: [
        {
          slug: {
            [Sequelize.Op.like]: `%${name}%`
          }
        },
        {
          name: {
            [Sequelize.Op.like]: `%${name}%`
          }
        },
        {
          contract_address: {
            [Sequelize.Op.like]: `%${name}%`
          }
        }
      ]
    }
  }

  let order_by = "";
  if ('order_by' in ctx.request.query) {
    order_by = ctx.request.query['order_by'];
  }

  let order = [['id', 'ASC']]
  if (order_by && ['one_day_volume', 'serven_day_volume', 'thirty_day_volume', 'total_volume'].indexOf(order_by) > -1) {
    order = [[order_by, 'DESC']]
  }

  const { rows, count } = await OpenseaCollections.findAndCountAll({
    where: criteria,
    offset: (page.valueOf() - 1) * limit.valueOf(),
    limit: limit,
    order: order
  });
  ctx.body = {
    page: page,
    limit: limit,
    total: count,
    collections: rows.map(collection => {
      return {
        slug: collection.slug,
        name: collection.name,
        schema: collection.schema,
        contract: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
        total_supply: collection.total_supply,
        image: collection.image_url,
        floor_price: parseFloat(parseFloat(collection.floor_price).toFixed(4))
      }
    })
  }
});


const fetchEvents = async (contractAddress, eventType, occurredAfter) => {
  const openseaKeys = process.env.OPENSEA_API_KEYS.split(',');
  const openseaKey = _.sample(openseaKeys);
  const url = `https://api.opensea.io/api/v1/events?asset_contract_address=${contractAddress}${eventType ? `&event_type=${eventType}` : ""}${occurredAfter ? `&occurred_after=${occurredAfter}` : ""}&format=json`;
  const response = await gotScraping({
    url: url,
    headers: {
      'content-type': 'application/json',
      'x-api-key': openseaKey,
    },
  });
  try {
    return JSON.parse(response.body);
  } catch (error) {
    console.log(`fetch event using api-key ${openseaKey} error`, error);
    return [];
  }
}

CollectionsRouter.get('/:slug', async (ctx) => {
  let slug = ctx.params.slug;
  if (!slug) {
    ctx.status = 404;
    ctx.body = {
      error: HttpError[HttpError.NO_COLLECTION_FOUND]
    }
    return;
  }

  let criteria = {};
  if (slug.lastIndexOf("0x") === 0 && ethers.utils.isAddress(slug)) {
    criteria = {
      contract_address: Buffer.from(slug.slice(2), 'hex')
    }
  } else {
    criteria = {
      slug: slug
    }
  }
  const collection = await OpenseaCollections.findOne({
    where: criteria
  });
  if (!collection) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }

  ctx.body = {
    slug: collection.slug,
    name: collection.name,
    schema: collection.schema,
    contract: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
    total_supply: collection.total_supply,
    image: collection.image_url,
    banner_image: collection.banner_image,
    floor_price: parseFloat(parseFloat(collection.floor_price).toFixed(4)),
    description: collection.description,
    extener_url: collection.extener_url,
    discord_url: collection.discord_url,
    twitter_username: collection.twitter_username,
    instagram_username: collection.instagram_username,
    taker_relayer_fee: collection.taker_relayer_fee,
    num_owners: collection.num_owners,
    one_day_sales: collection.one_day_sales,
    seven_day_sales: collection.seven_day_sales,
    thirty_day_sales: collection.thirty_day_sales,
    total_sales: collection.total_sales,
    one_day_volume: collection.one_day_volume,
    seven_day_volume: collection.seven_day_volume,
    thirty_day_volume: collection.thirty_day_volume,
    total_volume: collection.total_volume,
    market_cap: collection.market_cap,
    traits: collection.traits,
  }
});



CollectionsRouter.get('/:slug/events', async (ctx) => {
  let slug = ctx.params.slug;
  if (!slug) {
    ctx.status = 404;
    ctx.body = {
      error: HttpError[HttpError.NO_COLLECTION_FOUND]
    }
    return;
  }

  let criteria = {};
  if (slug.lastIndexOf("0x") === 0 && ethers.utils.isAddress(slug)) {
    criteria = {
      contract_address: Buffer.from(slug.slice(2), 'hex')
    }
  } else {
    criteria = {
      slug: slug
    }
  }
  const collection = await OpenseaCollections.findOne({
    where: criteria
  });
  if (!collection) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_SLUG]
    }
    return;
  }

  let occurred_after = getNumberQueryParam('occurred_after', ctx);
  if (occurred_after <= 0) {
    occurred_after = 0;
  }
  let event_type = '';
  if ('event_type' in ctx.request.query) {
    event_type = ctx.request.query['event_type'];
  }

  const res = await fetchEvents('0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'), event_type, occurred_after);
  let events = [];
  if (res.asset_events.length > 0) {
    Array.prototype.push.apply(events, _.map(res.asset_events, (item) => ({
      event_timestamp: new Date(item.event_timestamp).getTime(),
      asset: item.asset,
      event_type: item.event_type,
      from_account: item.from_account,
      total_price: item.total_price,
      payment_token: item.payment_token,
      transaction: item.transaction,
      quantity: item.quantity,
      seller: item.seller,
      is_private: item.is_private,
      duration: item.duration,
      bid_amount: item.bid_amount,
    })));
  }
  ctx.body = events;
});


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

module.exports = CollectionsRouter;