import Router from 'koa-router'
import * as _ from 'lodash'
import Collection from '../entity/collection';
import { OpenSeaPort, Network } from 'opensea-js'
import HDWalletProvider from '@truffle/hdwallet-provider'
import ethers from 'ethers'
import { Token } from '../model/model'

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

  let page: Number = 1;
  if ('page' in ctx.request.query) {
    page = Number(ctx.request.query['page']);
    if (page <= 0) {
      page = 1;
    }
  }
  let limit: Number = 50;
  if ('limit' in ctx.request.query) {
    limit = Number(ctx.request.query['limit']);
    if (limit < 0) {
      limit = 50;
    }
    if (limit > 100) {
      limit = 100;
    }
  }
  let min_rank: Number = collection.total_supply;
  if ('min_rank' in ctx.request.query) {
    min_rank = Number(ctx.request.query['min_rank']);
    if (min_rank <= 0) {
      min_rank = 10;
    }
    if (min_rank > collection.total_supply) {
      min_rank = collection.total_supply;
    }
  }
  let max_rank: Number = 1;
  if ('max_rank' in ctx.request.query) {
    max_rank = Number(ctx.request.query['max_rank']);
    if (max_rank < 0) {
      max_rank = 1;
    }
    if (max_rank > collection.total_supply) {
      max_rank = collection.total_supply;
    }
  }
  let traits: string[] = [];
  if ('traits' in ctx.request.query) {
    if (ctx.request.query['traits'] instanceof Array) {
      traits = ctx.request.query['traits'];
    } else {
      traits = [ctx.request.query['traits']]
    }
    traits = traits.filter(trait => {
      return trait.includes('|') && trait.split('|').length == 2
    });
  }
  let allTokens = JSON.parse(collection.tokens);
  let filtedTokens: Token[] = [];
  if (traits.length > 0) {
    const traitsMap = _.groupBy(traits, function (item) {
      return item.split("|")[0];
    });
    for (let tokenIndex in allTokens) {
      let token = allTokens[tokenIndex];
      let allContains = true;
      for (let traitType in traitsMap) {
        let traitContains = false;
        for (let traitIndex in traitsMap[traitType]) {
          let traitValue = traitsMap[traitType][traitIndex].split('|')[1];
          for (let tokenTraitIndex in token.traits) {
            if (token.traits[tokenTraitIndex].type == traitType && token.traits[tokenTraitIndex].value == traitValue) {
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
        filtedTokens.push(token);
      }
    }
  } else {
    filtedTokens = allTokens;
  }
  filtedTokens = filtedTokens.filter(token => {
    return token.rank >= max_rank && token.rank <= min_rank;
  });

  filtedTokens = _.sortBy(filtedTokens, 'rank');
  if (!allTokens || allTokens.length == 0 || allTokens.length < collection.total_supply) {
    let start_index = collection.total_revealed + collection.start_index;
    for (let index = start_index; index < collection.total_supply + collection.start_index; index++) {
      let item: Token = { token_id: index, image: collection.image_url, score: 0, rank: collection.total_supply, traits: [] };
      filtedTokens.push(item);
    }
  }


  ctx.body = {
    page: page,
    limit: limit,
    total: filtedTokens.length,
    supply: allTokens.length,
    tokens: filtedTokens.slice((page.valueOf() - 1) * limit.valueOf(), page.valueOf() * limit.valueOf())
  }
});


router.post('/:slug/bid', async (ctx, next) => {
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
  const provider = new HDWalletProvider(ctx.request.body.privite_key, process.env.ETH_RPC_URL);
  const wallet = new ethers.Wallet(ctx.request.body.privite_key);
  const seaport = new OpenSeaPort(provider, {
    networkName: Network.Main,
    apiKey: process.env.ETH_API_KEY
  })
  const token_ids = ctx.request.body.token_ids;
  const token_address = collection.contract_address;
  if (token_ids && token_ids.length > 0) {
    // @todo save it to db and to it async
    for (let index in token_ids) {
      seaport.createBuyOrder({
        asset: {
          tokenAddress: token_address,
          tokenId: token_ids[index]
        },
        accountAddress: wallet.address,
        startAmount: ctx.request.body.bid_price,
        expirationTime: ctx.request.body.bid_expiry
      }).catch((err) => {
        console.log(`${wallet.address} bid ${token_address} ${token_ids[index]} failed`, err);
      }).then((offer) => {
        if (offer) {
          const _asset = offer.asset;
          console.log(`${wallet.address} bid on ${_asset.name}, which contract is: ${_asset.tokenAddress} and item id is: ${_asset.tokenId}`)
        }
      })
    }
  }
  ctx.body = { "succuess": true };
});

export default router;