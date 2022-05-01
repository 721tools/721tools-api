import Router from 'koa-router'
import axios from 'axios'
import _ from 'underscore'
import { Trait, Token } from '../model/model'
const router = new Router({})

const ethers = require('ethers');
import genericErc721Abi from "../abis/ERC721.json";
import Collection from '../entity/collection';


const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);

const chunk = 100;

const downloadMetadata = async (contract_address) => {
  try {
    const collectionRes = await axios.get(`https://api.opensea.io/api/v1/asset_contract/${contract_address}`, {
      headers: {
        "X-API-KEY": process.env.ETH_API_KEY
      }
    });
    const collection = collectionRes.data.collection;
    const contract = new ethers.Contract(contract_address, genericErc721Abi, provider);
    const totalSupply = parseInt((await contract.totalSupply()).toString());
    let firstTokenIndex = 0;
    let tokenURI = "";
    try {
      tokenURI = await contract.tokenURI(firstTokenIndex);
    } catch (err) {
      firstTokenIndex = 1;
      tokenURI = await contract.tokenURI(firstTokenIndex);
    }
    const tokenURIPattern = tokenURI.replace(firstTokenIndex.toString(), "{}");

    const tokenIds = [...Array(totalSupply).keys()].map(i => i + firstTokenIndex);

    let metadatas = [];
    let startTime = new Date().getTime()
    let total_revealed = totalSupply;
    for (let i = 0, j = tokenIds.length; i < j; i += chunk) {
      let chunkStartTime = new Date().getTime()
      console.log("start: ", i, "/end: ", i + chunk - 1, "/all:", j);
      const temporaryJobs = tokenIds.slice(i, i + chunk).map(tokenId => {
        return getAttr(tokenURIPattern, tokenId)
      });
      const res = await download(temporaryJobs);
      const filtedRes = res.filter(item => {
        return !(!item.attributes || item.attributes.length == 0)
      });
      metadatas = metadatas.concat(filtedRes);
      console.log(`res of ${i} to ${i + chunk - 1} takes ${new Date().getTime() - chunkStartTime} ms`, 'len', res.length)
      if (filtedRes.length < res.length) {
        total_revealed = metadatas.length;
        break;
      }
    }
    console.log('work finished, takes ms', new Date().getTime() - startTime)

    const traits = calcTraits(metadatas);
    const tokens = getTokens(metadatas, traits);
    if (await Collection.count({
      where: {
        contract_address: contract_address
      }
    }) > 0) {
      Collection.update({
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        chain: "ETH",
        start_index: firstTokenIndex,
        total_supply: totalSupply,
        current_supply: totalSupply,
        total_revealed: total_revealed,
        image_url: collection.image_url,
        tokens: JSON.stringify(tokens),
        traits: JSON.stringify(traits)
      }, { where: { contract_address: contract_address } });
    } else {
      Collection.build({
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        contract_address: contract_address,
        chain: "ETH",
        start_index: firstTokenIndex,
        total_supply: totalSupply,
        current_supply: totalSupply,
        total_revealed: total_revealed,
        image_url: collection.image_url,
        tokens: JSON.stringify(tokens),
        traits: JSON.stringify(traits)
      }).save();
    }


  } catch (err) {
    console.log(err);
  }


};

const getAttr = async (tokenURIPattern, tokenId) => {
  try {
    const metajson = await axios.get(tokenURIPattern.replace("{}", tokenId, { timeout: 3000 }));
    if (!metajson || !metajson.data) {
      console.log('empty resp in getAttr, try again, tokenId=', tokenId)
      return await getAttr(tokenURIPattern, tokenId)
    }
    return { id: tokenId, attributes: metajson.data.attributes, image: metajson.data.image }
  }
  catch (x) {
    console.log('error in getAttr, tokenId=', tokenId, x.message)
    return await getAttr(tokenURIPattern, tokenId)
  }
}

const download = async (jobs) => {
  try {
    let attrResult = await axios.all(jobs)
    const res = _.compact(attrResult)
    return res;
  } catch (error) {
    console.log('error in download', error.message)
    return await download(jobs);
  }
}


let calcTraits = function (metadatas): Trait[] {
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
  return items;
}


let getTokens = function (metadatas, traits): Token[] {
  const traitsMap = _.groupBy(traits, function (item) {
    return item.type + "|" + item.value;
  });

  const traitsCategories = _.groupBy(traits, function (item) {
    return item.type;
  });

  let tokens: Token[] = [];
  for (let i = 0; i < metadatas.length; i++) {
    const token = metadatas[i];
    const { id, image, attributes } = token;
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
    let item: Token = { token_id: id, image: image, score: parseFloat(score.toFixed(2)), rank: 0, traits: traits };
    tokens.push(item);
  }

  const tokenIdsSorted = Object.keys(tokens).sort(function (a, b) { return tokens[b].score - tokens[a].score });
  for (let index in tokens) {
    tokens[index].rank = tokenIdsSorted.indexOf(tokens[index].token_id.toString()) + 1;
  }
  return tokens;
}

router.get('/:contract_address', async (ctx) => {
  downloadMetadata(ctx.params.contract_address);
  ctx.body = "OK";
});

export default router