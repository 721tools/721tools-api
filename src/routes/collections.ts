import Router from 'koa-router';
import Sequelize from 'sequelize';
import { OpenseaCollections } from '../dal/db';

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
  if (limit > 20) {
    limit = 20;
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
        contract: collection.contract_address,
        total_supply: collection.total_supply,
        image: collection.image_url,
        floor_price: collection.floor_price
      }
    })
  }
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