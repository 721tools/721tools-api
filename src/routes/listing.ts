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

  let collecitonCriteria: any = {
    schema: 'ERC721'
  };
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

  const collectionsRes = await OpenseaCollections.findAll({
    where: collecitonCriteria, limit: limit,
  });

  if (!collectionsRes || collectionsRes.length == 0) {
    ctx.body = []
    return;
  }

  const collectionMap = new Map(collectionsRes.map(i => [i.slug, i.dataValues]));
  let orderCriteria: any = {
    schema: 'ERC721'
  };
  ctx.body = {
    collectionMap
  }
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