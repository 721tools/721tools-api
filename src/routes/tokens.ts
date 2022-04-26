import Router from 'koa-router'
import * as _ from 'lodash'
import { Trait, Token } from '../model/model'
import { OpenSeaPort, Network } from 'opensea-js'
import metadatas from '../data/metadatas.0xd532b88607b1877fe20c181cba2550e3bbd6b31c.json'
import ethers from 'ethers'
import HDWalletProvider from '@truffle/hdwallet-provider'

const router = new Router();
router.get('/traits', async (ctx) => {
  ctx.body = calcTraits();
});

router.get('/tokens', async (ctx) => {
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
      page = 50;
    }
    if (limit > 100) {
      limit = 100;
    }
  }
  let min_rank: Number = metadatas.length;
  if ('min_rank' in ctx.request.query) {
    min_rank = Number(ctx.request.query['min_rank']);
    if (min_rank <= 0) {
      min_rank = 10;
    }
    if (min_rank > metadatas.length) {
      min_rank = metadatas.length;
    }
  }
  let max_rank: Number = 1;
  if ('max_rank' in ctx.request.query) {
    max_rank = Number(ctx.request.query['max_rank']);
    if (max_rank < 0) {
      max_rank = 1;
    }
    if (max_rank > metadatas.length) {
      max_rank = metadatas.length;
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
  let allTokens = getTokens();
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


  ctx.body = {
    page: page,
    limit: limit,
    total: filtedTokens.length,
    supply: allTokens.length,
    tokens: filtedTokens.slice((page.valueOf() - 1) * limit.valueOf(), page.valueOf() * limit.valueOf())
  }
});


router.post('/tokens/bid', async (ctx, next) => {
  const provider = new HDWalletProvider(ctx.request.body.privite_key, "https://eth-mainnet.alchemyapi.io/v2/nFvCkBjYskYZdpdXO1bnNW1epn6Muz7G");
  const wallet = new ethers.Wallet(ctx.request.body.privite_key);
  const seaport = new OpenSeaPort(provider, {
    networkName: Network.Main,
    apiKey: "a680542f053b4de3a9a99e945936b8c7"
  })
  const token_ids = ctx.request.body.token_ids;
  const token_address = "0xd532b88607b1877fe20c181cba2550e3bbd6b31c";
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

let calcTraits = function (): Trait[] {
  let traits = {};
  let traitCounts = {};
  let traitValues = {};
  for (let i = 0; i < metadatas.length; i++) {
    const token = metadatas[i];
    const { attributes } = token;
    if (attributes.length in traitCounts) {
      traitCounts[attributes.length] += 1;
    } else {
      traitCounts[attributes.length] = 1;
    }

    attributes.forEach((trait: { value: string; trait_type: string; }) => {
      if (!trait.value) { return; }
      if (traits[trait.trait_type]) {
        if (!traits[trait.trait_type][trait.value]) {
          traits[trait.trait_type][trait.value] = 0;
        }
      } else {
        traits[trait.trait_type] = {}
        traits[trait.trait_type][trait.value] = 0;
      }
      if (trait.trait_type + "|" + trait.value in traitValues) {
        traitValues[trait.trait_type + "|" + trait.value] += 1;
      } else {
        traitValues[trait.trait_type + "|" + trait.value] = 1;
      }
    });
  }

  for (let trait in traits) {
    let noneCount = metadatas.length;
    for (let value in traits[trait]) {
      noneCount -= traitValues[trait + "|" + value];
      traits[trait][value] = traitValues[trait + "|" + value]
    }
    if (noneCount > 0) {
      traits[trait]["None"] = noneCount;
    }
  }
  traits["Traits count"] = {}
  for (let traitCount in traitCounts) {
    traits["Traits count"][traitCount] = traitCounts[traitCount];
  }

  let items: Trait[] = [];
  for (let trait in traits) {
    for (let value in traits[trait]) {
      let score = parseFloat((metadatas.length / Object.keys(traits[trait]).length / traits[trait][value]).toFixed(2));
      let item: Trait = { type: trait, value: value, occurrences: traits[trait][value], percentage: parseFloat((traits[trait][value] / metadatas.length * 100).toFixed(2)), score: score };
      items.push(item);
    }
  }
  // @todo save the shit
  return items;
}


let getTokens = function (): Token[] {
  const traits = calcTraits();
  const traitsMap = _.groupBy(traits, function (item) {
    return item.type + "|" + item.value;
  });

  const traitsCategories = _.groupBy(traits, function (item) {
    return item.type;
  });

  let tokens: Token[] = [];
  for (let i = 0; i < metadatas.length; i++) {
    const token = metadatas[i];
    const { tokenId, image, attributes } = token;
    let score = traitsMap["Traits count|" + attributes.length][0].score;

    let leftCategories = Object.keys(traitsCategories);
    leftCategories.splice(leftCategories.indexOf("Traits count"), 1);

    let traits: Trait[] = [];
    attributes.forEach((trait: { value: string; trait_type: string; }) => {
      if (!trait.value) { return; }
      score = score.valueOf() + traitsMap[trait.trait_type + "|" + trait.value][0].score.valueOf();
      traits.push(traitsMap[trait.trait_type + "|" + trait.value][0]);
      leftCategories.splice(leftCategories.indexOf(trait.trait_type), 1);
    });
    if (leftCategories.length > 0) {
      for (let category in leftCategories) {
        score = score.valueOf() + traitsMap[leftCategories[category] + "|" + "None"][0].score.valueOf();
        traits.push(traitsMap[leftCategories[category] + "|" + "None"][0]);
      }
    }

    traits.push(traitsMap["Traits count|" + attributes.length][0]);
    let item: Token = { token_id: tokenId, image: image, score: parseFloat(score.toFixed(2)), rank: 0, traits: traits };
    tokens.push(item);
  }

  const tokenIdsSorted = Object.keys(tokens).sort(function (a, b) { return tokens[b].score - tokens[a].score });
  for (let index in tokens) {
    tokens[index].rank = tokenIdsSorted.indexOf(tokens[index].token_id.toString()) + 1;
  }

  // @todo save the shit
  return tokens;
}

export default router;
