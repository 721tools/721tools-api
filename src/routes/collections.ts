import Router from 'koa-router';
import Sequelize from 'sequelize';
import { ethers } from 'ethers';

import _ from 'underscore';
import { OpenseaCollections, OpenseaCollectionsHistory, Orders, NFTTrades, OpenseaItems } from '../dal/db';
import { HttpError } from '../model/http-error';
import { OrderType } from '../model/order-type';
import { parseTokenId } from "../helpers/binary_utils";
import { getNumberQueryParam, getNumberParam } from "../helpers/param_utils";
import { setItemInfo, setOrderItemInfo, setNftTradesItemInfo, getItemsByTraitsAndSkipFlagged } from "../helpers/item_utils";

const clickhouse = require('../dal/clickhouse');
const Op = Sequelize.Op;

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

  criteria['schema'] = ['ERC721', 'CRYPTOPUNKS'];
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
  const results = [];

  for (const collection of rows) {
    const sevendaysVolumns = ctx.request.query['include_sevendays_volumns'] ? await getSevenDaysVolumns(collection) : [];
    const sevendays = Object.keys(sevendaysVolumns);
    const oneDayPriceChange = sevendaysVolumns[sevendays[sevendays.length - 1]] - sevendaysVolumns[sevendays[sevendays.length - 2]];
    results.push({
      slug: collection.slug,
      name: collection.name,
      schema: collection.schema,
      contract: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
      total_supply: collection.total_supply,
      image: collection.image_url,
      floor_price: parseFloat(parseFloat(collection.floor_price).toFixed(4)),
      verified: collection.verified,
      rarity_enabled: collection.rarity_enabled,
      sevendays_volumns: sevendaysVolumns,
      one_day_price_change: oneDayPriceChange,
    });
  }
  ctx.body = {
    page: page,
    limit: limit,
    total: count,
    collections: results
  }
});

const getSevenDaysVolumns = async (collection) => {
  const endTimestamp = new Date().getTime() - (8 * 24 * 60 * 60 * 1000);
  const historys = await OpenseaCollectionsHistory.findAll({
    where: {
      contract_address: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
      create_time: { [Sequelize.Op.gt]: new Date(endTimestamp) },
    },
    order: [['id', 'ASC']]
  });
  const lastDay = new Date().setHours(0, 0, 0, 0);
  const firstDay = lastDay - 6 * 24 * 60 * 60 * 1000;

  const result = {};
  if (historys.length >= 7) {
    let day = firstDay;
    let lastVolumn = 0;
    for (const history of historys) {
      if (day > lastDay) {
        break;
      }
      let dayMissed = true;
      while (new Date(history.create_time).getTime() < day) {
        dayMissed = false;
        continue;
      }
      if (!dayMissed) {
        result[new Date(day).toISOString().slice(0, 10).replace(/-/g, "")] = lastVolumn == 0 ? 0 : history.total_volume - lastVolumn;
        lastVolumn = history.total_volume;
        day += 24 * 60 * 60 * 1000;
      } else {
        result[new Date(day).toISOString().slice(0, 10).replace(/-/g, "")] = 0;
        lastVolumn = history.total_volume;
        day += 24 * 60 * 60 * 1000;
      }
    }
  } else {
    for (let day = firstDay; day <= lastDay; day += 24 * 60 * 60 * 1000) {
      result[new Date(day).toISOString().slice(0, 10).replace(/-/g, "")] = 0;
    }
  }
  return result;
}

CollectionsRouter.get('/highlighted', async (ctx) => {
  let limit = getNumberQueryParam('limit', ctx);
  if (limit <= 0) {
    limit = 20;
  }
  if (limit > 50) {
    limit = 50;
  }

  const orders = await Orders.findAll({
    where: {
      type: 1,
    },
    attributes: [
      [Sequelize.fn('DISTINCT', Sequelize.col('contract_address')), 'contract_address'],
      'id',
    ],
    order: [
      ["id", "DESC"]
    ],
    limit: limit,
  });

  if (orders.length == 0) {
    ctx.body = [];
    return;
  }

  var contract_addresses = orders.map(order => {
    return order.contract_address
  });


  const collections = await OpenseaCollections.findAll({
    where: {
      contract_address: contract_addresses
    },
  });
  ctx.body =
    collections.map(collection => {
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
  };


  const historys = await OpenseaCollectionsHistory.findAll({
    where: {
      contract_address: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
      create_time: { [Sequelize.Op.lte]: new Date(collection.update_time.getTime() - (24 * 60 * 60 * 1000)) },
    },
    limit: 1,
    order: [['id', 'DESC']]
  });

  let history = null;
  if (historys && historys.length > 0) {
    history = historys[historys.length - 1];
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
    one_day_market_cap_change: history ? collection.market_cap - history.market_cap : 0,
    one_day_num_owners_change: history ? collection.num_owners - history.num_owners : 0,
    one_day_floor_price_change: history ? collection.floor_price - history.floor_price : 0,
  }
});

CollectionsRouter.post('/:slug/events', async (ctx) => {
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

  let occurred_after = getNumberParam('occurred_after', ctx);
  if (occurred_after <= 0) {
    occurred_after = 0;
  }
  let limit = getNumberParam('limit', ctx);
  if (limit <= 0) {
    limit = 20;
  }
  if (limit > 100) {
    limit = 100
  }
  let event_types = [];
  if ('event_types' in ctx.request.body) {
    if (ctx.request.body['event_types'] instanceof Array) {
      event_types = ctx.request.body['event_types'];
    } else {
      event_types = [ctx.request.body['event_types']]
    }
  }
  if (event_types.length == 0) {
    event_types = ["AUCTION_SUCCESSFUL", OrderType[OrderType.AUCTION_CREATED], OrderType[OrderType.OFFER_ENTERED], OrderType[OrderType.COLLECTION_OFFER]];
  }
  const traits = ctx.request.body['traits'];
  const skipFlagged = ctx.request.body['skip_flagged'];
  let items = _.isEmpty(traits) && !skipFlagged ? null : await getItemsByTraitsAndSkipFlagged(collection, traits, skipFlagged);
  if (items && items.length == 0) {
    ctx.body = [];
    return;
  }
  let events = [];
  if (event_types.includes(OrderType[OrderType.AUCTION_CREATED])
    || event_types.includes(OrderType[OrderType.OFFER_ENTERED])
    || event_types.includes(OrderType[OrderType.COLLECTION_OFFER])) {
    const types = [];
    if (event_types.includes(OrderType[OrderType.AUCTION_CREATED])) {
      types.push(OrderType.AUCTION_CREATED);
    }
    if (event_types.includes(OrderType[OrderType.OFFER_ENTERED])) {
      types.push(OrderType.OFFER_ENTERED);
    }
    if (event_types.includes(OrderType[OrderType.COLLECTION_OFFER])) {
      types.push(OrderType.COLLECTION_OFFER);
    }

    const where = {
      contract_address: collection.contract_address,
      type: {
        [Op.in]: types,
      },
    };
    if (occurred_after > 0) {
      where['order_event_timestamp'] = { [Sequelize.Op.gt]: new Date(occurred_after) }
    }

    if (items != null && items.length > 0) {
      const tokenIds = _.map(items, (item) => item.token_id);
      where['token_id'] = tokenIds;
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
        from: item.from,
        owner_address: item.owner_address ? '0x' + Buffer.from(item.owner_address, 'binary').toString('hex') : "",
        event_timestamp: item.order_event_timestamp.getTime(),
        event_type: OrderType[item.type],
        quantity: item.quantity,
      })));
    }
  }

  if (event_types.includes("AUCTION_SUCCESSFUL")) {
    const tradeWhere = {
      address: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
      timestamp: {
        [Sequelize.Op.gte]: new Date(occurred_after)
      }
    }
    if (items) {
      const tokenIds = _.map(items, (item) => parseInt(item.token_id.toString("hex"), 16));
      tradeWhere['tokenId'] = tokenIds;
    }
    const nftTrades = await NFTTrades.findAll({
      where: tradeWhere,
      order: [
        ["height", "DESC"],
        ["logIndex", "DESC"],
      ],
      limit: 20,
    });
    if (nftTrades.length > 0) {
      Array.prototype.push.apply(events, _.map(nftTrades, (item) => ({
        token_id: parseInt(item.tokenId),
        price: parseFloat(ethers.utils.formatUnits(item.priceETH, 'ether')),
        from: item.seller,
        to: item.buyer,
        height: item.height,
        logIndex: item.logIndex,
        tx_hash: item.tx_hash,
        event_type: "AUCTION_SUCCESSFUL",
        event_timestamp: item.timestamp.getTime()
      })));
    }
  }

  if (events.length > 0) {
    if (!items) {
      items = await OpenseaItems.findAll({
        where: {
          contract_address: collection.contract_address,
          token_id: events.map(item => parseTokenId(item.token_id))
        },
      });
    }

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
          events[index] = event;
        }
      }

      events.sort(function (a, b) {
        if (a.event_timestamp === b.event_timestamp && a.event_type == b.event_type && a.event_type == "AUCTION_SUCCESSFUL") {
          return b.logIndex - a.logIndex;
        }
        return b.event_timestamp > a.event_timestamp ? 1 : -1;
      });

      events = events.slice(0, 20);
    }
  }

  ctx.body = events;
});


CollectionsRouter.post('/:slug/listings', async (ctx) => {
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

  let occurred_after = getNumberParam('occurred_after', ctx);
  if (occurred_after <= 0) {
    occurred_after = 0;
  }
  let limit = getNumberParam('limit', ctx);
  if (limit <= 0) {
    limit = 20;
  }
  if (limit > 100) {
    limit = 100
  }
  const traits = ctx.request.body['traits'];
  const skipFlagged = ctx.request.body['skip_flagged'];
  let items = _.isEmpty(traits) && !skipFlagged ? null : await getItemsByTraitsAndSkipFlagged(collection, traits, skipFlagged);
  if (items && items.length == 0) {
    ctx.body = [];
    return;
  }
  const where = {
    contract_address: collection.contract_address,
    status: 1,
    type: OrderType.AUCTION_CREATED,
    order_expiration_date: {
      [Sequelize.Op.gt]: new Date()
    },
  };

  if (occurred_after > 0) {
    where['order_event_timestamp'] = { [Sequelize.Op.gt]: new Date(occurred_after) }
  }

  if (items != null && items.length > 0) {
    const tokenIds = _.map(items, (item) => item.token_id);
    where['token_id'] = tokenIds;
  }

  const orders = await Orders.findAll({
    where: where,
    order: [
      ["order_event_timestamp", "DESC"]
    ],
    limit: 100,
  });

  if (items) {
    await setOrderItemInfo(orders, items, collection);
  } else {
    await setItemInfo(orders, collection);
  }
  ctx.body = _.map(orders, (item) => ({
    token_id: parseInt(item.token_id.toString("hex"), 16),
    price: item.price,
    from: item.from,
    owner_address: item.owner_address ? '0x' + Buffer.from(item.owner_address, 'binary').toString('hex') : "",
    event_timestamp: item.order_event_timestamp.getTime(),
    quantity: item.quantity,
    name: item.name,
    image: item.image,
    rank: item.rank,
    supports_wyvern: item.supports_wyvern,
  }));
});

CollectionsRouter.post('/:slug/sales', async (ctx) => {
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

  let occurred_after = getNumberParam('occurred_after', ctx);
  if (occurred_after <= 0) {
    occurred_after = 0;
  }
  let limit = getNumberParam('limit', ctx);
  if (limit <= 0) {
    limit = 20;
  }
  if (limit > 100) {
    limit = 100
  }
  const traits = ctx.request.body['traits'];
  const skipFlagged = ctx.request.body['skip_flagged'];
  let items = _.isEmpty(traits) && !skipFlagged ? null : await getItemsByTraitsAndSkipFlagged(collection, traits, skipFlagged);
  if (items && items.length == 0) {
    ctx.body = [];
    return;
  }

  let end_time = getNumberQueryParam('end_time', ctx);
  if (end_time <= 0) {
    end_time = new Date().getTime();
  }

  const tradeWhere = {
    address: '0x' + Buffer.from(collection.contract_address, 'binary').toString('hex'),
    timestamp: {
      [Sequelize.Op.gte]: new Date(occurred_after),
      [Sequelize.Op.lt]: new Date(end_time)
    }
  }
  if (items) {
    const tokenIds = _.map(items, (item) => parseInt(item.token_id.toString("hex"), 16));
    tradeWhere['tokenId'] = tokenIds;
  }
  const nftTrades = await NFTTrades.findAll({
    where: tradeWhere,
    order: [
      ["height", "DESC"],
      ["logIndex", "DESC"],
    ],
  });
  let results = [];
  if (nftTrades.length > 0) {
    Array.prototype.push.apply(results, _.map(nftTrades, (item) => ({
      token_id: parseInt(item.tokenId),
      price: parseFloat(ethers.utils.formatUnits(item.priceETH, 'ether')),
      from: item.plateform,
      owner_address: item.seller,
      to: item.buyer,
      height: item.height,
      log_index: item.logIndex,
      tx_hash: item.tx_hash,
      event_timestamp: new Date(item.timestamp).getTime(),
      quantity: item.amount,
    })));
    if (items) {
      await setNftTradesItemInfo(results, items, collection);
    } else {
      await setItemInfo(results, collection);
    }
  }
  ctx.body = results;
});

CollectionsRouter.post('/:slug/stats', async (ctx) => {
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

  let occurred_after = getNumberParam('occurred_after', ctx);
  if (occurred_after <= 0) {
    occurred_after = 0;
  }
  const traits = ctx.request.body['traits'];
  const skipFlagged = ctx.request.body['skip_flagged'];
  let items = _.isEmpty(traits) && !skipFlagged ? null : await getItemsByTraitsAndSkipFlagged(collection, traits, skipFlagged);
  if (items && items.length == 0) {
    ctx.body = {
      listings: 0,
      sales: 0,
    }
    return;
  }

  let end_time = getNumberQueryParam('end_time', ctx);
  if (end_time <= 0) {
    end_time = new Date().getTime();
  }

  const contract_address = ethers.utils.getAddress("0x" + Buffer.from(collection.contract_address, 'binary').toString('hex'));
  let query = `select count(*) as count from nft_trades where address = '${contract_address}' and timestamp >= FROM_UNIXTIME(${Math.floor(occurred_after / 1000)})  and timestamp < FROM_UNIXTIME(${end_time})`
  if (items != null && items.length > 0) {
    const tokenIds = _.map(items, (item) => parseInt(item.token_id.toString("hex"), 16));
    query += ` and tokenId in (${tokenIds.join(', ')})`;
  }
  const nftTrades = await clickhouse.query(query).toPromise();

  const where = {
    contract_address: collection.contract_address,
    status: 1,
    type: OrderType.AUCTION_CREATED,
    order_event_timestamp: { [Sequelize.Op.gt]: new Date(occurred_after) }
  };

  if (items != null && items.length > 0) {
    const tokenIds = _.map(items, (item) => item.token_id);
    where['token_id'] = tokenIds;
  }

  const ordersCount = await Orders.count({
    where: where,
  });
  ctx.body = {
    listings: ordersCount,
    sales: nftTrades && nftTrades.length > 0 && nftTrades[0].count > 0 ? nftTrades[0].count : 0,
  };
});

CollectionsRouter.post('/:slug/buy_estimate', async (ctx) => {
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

  let balance = getNumberParam('balance', ctx);
  let buyCount = getNumberParam('count', ctx);
  const result = { count: 0, amount: 0, tokens: [] };
  if (balance <= 0 && buyCount <= 0) {
    ctx.body = result;
    return;
  }


  const traits = ctx.request.body['traits'];
  const skipFlagged = ctx.request.body['skip_flagged'];
  let items = _.isEmpty(traits) && !skipFlagged ? null : await getItemsByTraitsAndSkipFlagged(collection, traits, skipFlagged);
  if (items && items.length == 0) {
    return result;
  }

  const where = {
    contract_address: collection.contract_address,
    status: 1,
    type: OrderType.AUCTION_CREATED,
    order_expiration_date: {
      [Sequelize.Op.gt]: new Date()
    },
  };

  if (items) {
    const tokenIds = _.map(items, (item) => item.token_id);
    where['token_id'] = tokenIds;
  }

  const orders = await Orders.findAll({
    where: where,
    order: [
      ["price", "ASC"]
    ],
    limit: 100,
  });

  const tokens = [];
  if (balance > 0) {
    let count = 0;
    let leftBalance = balance;
    for (const order of orders) {
      let quantity = order.quantity > 0 ? order.quantity : 1;
      if (leftBalance > order.price * quantity) {
        count += quantity;
        leftBalance -= order.price * quantity;
        tokens.push(order);
      } else {
        const plusCount = Math.floor(leftBalance / order.price);
        if (plusCount > 0) {
          count += plusCount
          tokens.push(order);
        }
        break;
      }
    }
    result.count = count;
  } else if (buyCount > 0) {
    let needAmount = 0;
    let leftCount = buyCount;
    for (const order of orders) {
      let quantity = order.quantity > 0 ? order.quantity : 1;
      if (leftCount <= 0) {
        break;
      }
      if (leftCount > quantity) {
        leftCount -= quantity;
        needAmount += order.price * quantity;
        tokens.push(order);
      } else {
        needAmount += (quantity - leftCount) * order.price;
        tokens.push(order);
        break;
      }
    }
    result.amount = needAmount;
  }
  if (tokens.length > 0) {
    if (items) {
      await setOrderItemInfo(orders, items, collection);
    } else {
      await setItemInfo(orders, collection);
    }
    Array.prototype.push.apply(result.tokens, _.map(tokens, (item) => ({
      token_id: parseInt(item.token_id.toString("hex"), 16),
      price: item.price,
      from: item.from,
      quantity: item.quantity > 0 ? item.quantity : 1,
      owner_address: item.owner_address ? '0x' + Buffer.from(item.owner_address, 'binary').toString('hex') : "",
      rank: item.rank,
      image: item.image,
      name: item.name,
      supports_wyvern: item.supports_wyvern,
    })));
  }

  ctx.body = result;
});


CollectionsRouter.post('/:slug/depth', async (ctx) => {
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

  let size = getNumberParam('size', ctx);
  if (size <= 0) {
    if (collection.floor_price >= 1000) {
      size = 1000;
    } else if (collection.floor_price >= 100) {
      size = 100;
    } else if (collection.floor_price >= 10) {
      size = 10;
    } else if (collection.floor_price >= 1) {
      size = 1;
    } else if (collection.floor_price >= 0.1) {
      size = 0.1;
    } else if (collection.floor_price >= 0.01) {
      size = 0.01;
    } else if (collection.floor_price >= 0.001) {
      size = 0.001;
    } else if (collection.floor_price >= 0.0001) {
      size = 0.0001;
    } else {
      size = 0.00001;
    }
  }

  let maxStepCount = getNumberQueryParam('count', ctx);
  if (maxStepCount <= 0) {
    maxStepCount = 10;
  } else if (maxStepCount > 100) {
    maxStepCount == 100;
  }


  const traits = ctx.request.body['traits'];
  const skipFlagged = ctx.request.body['skip_flagged'];
  let items = _.isEmpty(traits) && !skipFlagged ? null : await getItemsByTraitsAndSkipFlagged(collection, traits, skipFlagged);
  if (items && items.length == 0) {
    ctx.body = [];
    return;
  }
  const where = {
    where: {
      contract_address: collection.contract_address,
      status: 1,
      type: OrderType.AUCTION_CREATED,
      order_expiration_date: {
        [Sequelize.Op.gt]: new Date()
      },
    },
  };
  if (items) {
    const tokenIds = _.map(items, (item) => item.token_id);
    where['token_id'] = tokenIds;
  }

  const orders = await Orders.findAll(where);
  const depth = [];
  if (orders.length > 0) {
    orders.sort((a, b) => a.price - b.price);
    let count = 0;
    let stepCount = 1;
    let currentStartPrice = Math.floor(orders[0].price / size) * size;
    let nextPrice = parseFloat((currentStartPrice + size).toFixed(4));
    for (const index in orders) {
      const order = orders[index];
      let quantity = order.quantity > 0 ? order.quantity : 1;
      if (order.price < nextPrice) {
        count += quantity;
      } else {
        depth.push({
          price: parseFloat(currentStartPrice.toFixed(4)),
          count
        });

        if (stepCount < maxStepCount - 1) {
          stepCount++;
          while (nextPrice < order.price) {
            currentStartPrice = parseFloat((currentStartPrice + size).toFixed(4));
            nextPrice = parseFloat((currentStartPrice + size).toFixed(4));
          }
          currentStartPrice = nextPrice;
          nextPrice = parseFloat((currentStartPrice + size).toFixed(4));
          count = quantity;
        } else {
          count = orders.length - parseInt(index);
          while (nextPrice < order.price) {
            currentStartPrice = parseFloat((currentStartPrice + size).toFixed(4));
            nextPrice = parseFloat((currentStartPrice + size).toFixed(4));
          }
          currentStartPrice = nextPrice;
          break;
        }
      }
    }
    depth.push({
      price: parseFloat(currentStartPrice.toFixed(4)),
      count
    });

    ctx.body = depth;
    return;
  }
  ctx.body = depth;
});


module.exports = CollectionsRouter;