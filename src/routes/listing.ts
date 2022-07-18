import Router from 'koa-router';
import Sequelize from 'sequelize';
import { OpenseaCollections, Orders } from '../dal/db';

const ListingRouter = new Router({})
ListingRouter.get('/', async (ctx) => {
  let page = getNumberParam('page', ctx);
  let limit = getNumberParam('limit', ctx);
  if (limit <= 0) {
    limit = 50;
  }
  if (limit > 100) {
    limit = 100;
  }

  let start_listing_time = getNumberParam('start_listing_time', ctx);
  if (start_listing_time <= 0) {
    start_listing_time = Math.floor(Date.now());
  }

  let min_floor = getNumberParam('min_floor', ctx);
  let max_floor = getNumberParam('max_floor', ctx);
  let min_price = getNumberParam('min_price', ctx);
  let max_price = getNumberParam('max_price', ctx);
  let min_rank = getNumberParam('min_rank', ctx);
  let max_rank = getNumberParam('max_rank', ctx);
  let top_rank = getNumberParam('top_rank', ctx);

  const collections = ctx.request.query["collections"];

  let targetCollections = [];
  let collecitonCriteria: any = {};
  if (collections && collections.length > 0) {
    collecitonCriteria.slug = collections;
  }
  if (max_floor > 0) {
    collecitonCriteria.floor_price = {
      [Sequelize.Op.lte]: max_floor
    };
  }
  if (min_floor > 0) {
    collecitonCriteria.floor_price = {
      [Sequelize.Op.gte]: min_floor
    };
  }

  const collectionsRes = await OpenseaCollections.findAll(collecitonCriteria);
  ctx.body = {
    collectionsRes
  }



  // let name = "";
  // if ('name' in ctx.request.query) {
  //   name = ctx.request.query['name'];
  // }
  // let criteria = {};
  // if (name) {
  //   criteria = {
  //     [Sequelize.Op.or]: [
  //       {
  //         slug: {
  //           [Sequelize.Op.like]: `%${name}%`
  //         }
  //       },
  //       {
  //         name: {
  //           [Sequelize.Op.like]: `%${name}%`
  //         }
  //       },
  //       {
  //         contract_address: {
  //           [Sequelize.Op.like]: `%${name}%`
  //         }
  //       }
  //     ]
  //   }
  // }
  // const { rows, count } = await Collection.findAndCountAll({
  //   where: criteria,
  //   attributes: { exclude: ['tokens', 'traits'] },
  //   offset: (page.valueOf() - 1) * limit.valueOf(),
  //   limit: limit,
  //   order: [['id', 'ASC']]
  // });
  // ctx.body = {
  //   page: page,
  //   limit: limit,
  //   total: count,
  //   collections: rows.map(collection => {
  //     return {
  //       slug: collection.slug,
  //       name: collection.name,
  //       description: collection.description,
  //       chain: collection.chain,
  //       contract_address: collection.contract_address,
  //       image_url: collection.image_url,
  //       total_supply: collection.total_supply,
  //       current_supply: collection.current_supply,
  //       total_revealed: collection.total_revealed
  //     }
  //   })
  // }
});

const getNumberParam = (param, ctx) => {
  let paramValue: number = 0;
  if (param in ctx.request.query) {
    paramValue = Number(ctx.request.query[param]);
    if (paramValue < 0) {
      paramValue = 0;
    }
  }
  return paramValue;
};

module.exports = ListingRouter;