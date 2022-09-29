import Router from 'koa-router';
import Sequelize from 'sequelize';
import { ethers } from 'ethers';

import _ from 'underscore';
import { OpenseaCollections, Orders, NFTSales, OpenseaItems } from '../dal/db';
import { HttpError } from '../model/http-error';
import { parseAddress, parseTokenId } from "../helpers/binary_utils";

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

  let slugs = [];
  if ('slugs' in ctx.request.query) {
    if (ctx.request.query['slugs'] instanceof Array) {
      slugs = ctx.request.query['slugs'];
    } else {
      slugs = [ctx.request.query['slugs']]
    }
  }

  if (slugs.length > 0) {
    criteria['slug'] = slugs;
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
        floor_price: parseFloat(parseFloat(collection.floor_price).toFixed(4)),
        verified: collection.verified,
        rarity_enabled: collection.rarity_enabled,
      }
    })
  }
});

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
    verified: collection.verified,
    rarity_enabled: collection.rarity_enabled,
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
  let limit = getNumberQueryParam('limit', ctx);
  if (limit <= 0) {
    limit = 20;
  }
  if (limit > 100) {
    limit = 100
  }
  let event_types = [];
  if ('event_types' in ctx.request.query) {
    if (ctx.request.query['event_types'] instanceof Array) {
      event_types = ctx.request.query['event_types'];
    } else {
      event_types = [ctx.request.query['event_types']]
    }
  }
  if (event_types.length == 0) {
    event_types = ["AUCTION_CREATED", "OFFER_ENTERED", "AUCTION_SUCCESSFUL"];
  }
  let events = [];
  if (event_types.includes("AUCTION_CREATED") || event_types.includes("OFFER_ENTERED")) {
    const where = {
      contract_address: collection.contract_address,
    };
    if (occurred_after > 0) {
      where['order_event_timestamp'] = { [Sequelize.Op.gt]: new Date(occurred_after).toISOString() }
    }
    if (event_types.includes("AUCTION_CREATED")) {
      if (event_types.includes("OFFER_ENTERED")) {
        where['type'] = { [Sequelize.Op.in]: [0, 1] }
      } else {
        where['type'] = 0;
      }
    } else {
      where['type'] = 1;
    }

    const orders = await Orders.findAll({
      where: where,
      order: [
        ["id", "DESC"]
      ],
      limit: 20,
    });
    if (orders.length > 0) {
      Array.prototype.push.apply(events, _.map(orders, (item) => ({
        token_id: parseInt(item.token_id.toString("hex"), 16),
        price: item.price,
        from: '0x' + Buffer.from(item.owner_address, 'binary').toString('hex'),
        order_event_timestamp: item.order_event_timestamp,
        event_type: item.type == 0 ? "OFFER_ENTERED" : "AUCTION_CREATED"
      })));
    }
  }

  if (event_types.includes("AUCTION_SUCCESSFUL")) {
    const nftSales = await NFTSales.findAll({
      where: {
        offer_token: collection.contract_address,
        height: {
          [Sequelize.Op.gte]: 111
        }
      },
      order: [
        ["height", "DESC"],
        ["id", "DESC"]
      ],
      limit: 20,
    });
    if (nftSales.length > 0) {
      Array.prototype.push.apply(events, _.map(nftSales, (item) => ({
        token_id: parseInt(item.offer_identifier.toString("hex"), 16),
        price: item.price,
        from: '0x' + Buffer.from(item.from, 'binary').toString('hex'),
        to: '0x' + Buffer.from(item.to, 'binary').toString('hex'),
        height: item.height,
        tx_hash: '0x' + Buffer.from(item.tx_hash, 'binary').toString('hex'),
        event_type: "AUCTION_SUCCESSFUL",
        order_event_timestamp: "111222333"
      })));
    }
  }

  if (events.length > 0) {
    const items = await OpenseaItems.findAll({
      where: {
        contract_address: collection.contract_address,
        token_id: events.map(item => parseTokenId(item.token_id))
      },
    });

    if (items.length > 0) {
      const itemMap = new Map<string, typeof OpenseaItems>(items.map((item) => [parseInt(item.token_id.toString("hex"), 16), item.dataValues]));
      for (let index in events) {
        const event = events[index];
        if (itemMap.has(event.token_id)) {
          const item = itemMap.get(event.token_id);
          event.rank = item.traits_rank;
          event.image_url = item.image_url;
          event.name = item.name;
          events[index] = event;
        } else {
          event.rank = 0;
          event.image_url = collection.image_url;
          event.name = collection.name + " #" + event.token_id;
        }
      }

      // todo sort by time, id
      events = events.slice(20);
    }
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