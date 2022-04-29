import Router from 'koa-router'
import * as _ from 'lodash'
import { Trait, Token } from '../model/model'
import Collection from '../entity/collection';
const Sequelize = require('sequelize');

const router = new Router();
router.get('/', async (ctx) => {
  let page: number = 1;
  if ('page' in ctx.request.query) {
    page = Number(ctx.request.query['page']);
    if (page <= 0) {
      page = 1;
    }
  }
  let limit: number = 50;
  if ('limit' in ctx.request.query) {
    limit = Number(ctx.request.query['limit']);
    if (limit < 0) {
      limit = 50;
    }
    if (limit > 100) {
      limit = 100;
    }
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
  const { rows, count } = await Collection.findAndCountAll({
    where: criteria,
    attributes: { exclude: ['tokens', 'traits'] },
    offset: (page.valueOf() - 1) * limit.valueOf(),
    limit: limit,
    order: [['id', 'ASC']]
  });
  ctx.body = {
    page: page,
    limit: limit,
    total: count,
    collections: rows.map(collection => {
      return {
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        chain: collection.chain,
        contract_address: collection.contract_address,
        image_url: collection.image_url,
        total_supply: collection.total_supply,
        current_supply: collection.current_supply,
        total_revealed: collection.total_revealed
      }
    })
  }
});

router.get('/:slug', async (ctx) => {
  if (!ctx.params.slug) {
    ctx.status = 404;
    return;
  }
  const collection = await Collection.findOne({
    where: { slug: ctx.params.slug },
  });
  if (!collection) {
    ctx.status = 404;
    return;
  }
  ctx.body = {
    slug: collection.slug,
    name: collection.name,
    description: collection.description,
    chain: collection.chain,
    contract_address: collection.contract_address,
    image_url: collection.image_url,
    total_supply: collection.total_supply,
    current_supply: collection.current_supply,
    total_revealed: collection.total_revealed
  };
});

router.get('/:slug/traits', async (ctx) => {
  if (!ctx.params.slug) {
    ctx.status = 404;
    return;
  }
  const collection = await Collection.findOne({
    where: { slug: ctx.params.slug },
    attributes: { exclude: ['tokens'] }
  });
  if (!collection) {
    ctx.status = 404;
    return;
  }
  ctx.body = collection.traits;
});

router.get('/:slug/tokens', async (ctx) => {
  if (!ctx.params.slug) {
    ctx.status = 404;
    return;
  }
  const collection = await Collection.findOne({
    where: { slug: ctx.params.slug },
    attributes: { exclude: ['traits'] }
  });
  if (!collection) {
    ctx.status = 404;
    return;
  }
  ctx.body = collection.tokens;
});

export default router;
