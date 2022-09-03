import Router from 'koa-router';
import { ethers } from "ethers";
import axios from 'axios';
import { gotScraping } from 'got-scraping';
import _ from 'underscore';
import Sequelize from 'sequelize';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

import { OpenseaCollections, OpenseaItems } from '../dal/db';
import genericErc20Abi from "../abis/ERC20.json";
import { parseTokenId, parseAddress } from "../helpers/binary_utils";


const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
const erc20Contract = new ethers.Contract("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", genericErc20Abi, provider);

const WalletsRouter = new Router({});
const Op = Sequelize.Op;

const limiterFlexible = new RateLimiterMemory({
  points: 1,
  duration: 0.2,
})
const limiterQueue = new RateLimiterQueue(limiterFlexible);

const fetchItemsByOwner = async (owner: any, cursor: any) => {
  await limiterQueue.removeTokens(1);
  const url = `https://api.opensea.io/api/v1/assets?limit=200&owner=${owner}&order_direction=desc${cursor ? `&cursor=${cursor}` : ""}&format=json`;
  const response = await gotScraping({
    url: url,
    headers: {
      'content-type': 'application/json',
    },
  });
  return JSON.parse(response.body);
}


const fetchNFTs = async (owner: any) => {
  let cursor = null;
  let hasNextPage = true;
  let items = [];
  while (hasNextPage) {
    const data = await fetchItemsByOwner(owner, cursor);
    if (data.previous) {
      cursor = data.previous;
    } else {
      hasNextPage = false;
    }
    Array.prototype.push.apply(items, _.map(data.assets.reverse(), (item) => ({
      token_id: item.token_id,
      slug: item.collection.slug,
      name: item.name ? item.name : `${item.collection.name} #${item.token_id}`,
      schema: item.asset_contract.schema_name,
      contract: item.asset_contract.address,
      total_supply: item.asset_contract.total_supply,
      image: item.image_url ? item.image_url : "",
      floor_price: 0,
      last_price: item.last_sale ? parseFloat(parseFloat(ethers.utils.formatUnits(item.last_sale.total_price, 'ether')).toFixed(4)) : 0,
      rank: 0
    })));
  }
  return items;
}

const setFloorPrice = async (nfts) => {
  if (nfts && nfts.length > 0) {
    const contractAddresses = [...new Set(nfts.map(item => parseAddress(item.contract)))];
    const collectionsRes = await OpenseaCollections.findAll({
      where: {
        contract_address: contractAddresses
      }
    });

    if (collectionsRes && collectionsRes.length > 0) {
      const collectionMap = new Map<string, typeof OpenseaCollections>(collectionsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex'), item.dataValues]));
      for (let index in nfts) {
        const nft = nfts[index];
        if (collectionMap.has(nft.contract)) {
          const collection = collectionMap.get(nft.contract);
          nft.floor_price = parseFloat(parseFloat(collection.floor_price).toFixed(4));
          nft.total_supply = collection.total_supply;
        }
        nfts[index] = nft;
      }
    }
  }
  return nfts;
}

const setRank = async (nfts) => {
  if (nfts && nfts.length > 0) {
    const selectTokens = [];
    for (const nft of nfts) {
      selectTokens.push({
        "contract_address": parseAddress(nft.contract),
        "token_id": parseTokenId(nft.token_id)
      });
    }
    const itemsRes = await OpenseaItems.findAll({ where: { [Op.or]: selectTokens } });

    if (itemsRes && itemsRes.length > 0) {
      const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex') + parseInt(item.token_id.toString("hex"), 16), item.dataValues]));
      for (let index in nfts) {
        const nft = nfts[index];
        if (itemMap.has(nft.contract + nft.token_id)) {
          const item = itemMap.get(nft.contract + nft.token_id);
          nft.rank = item.traits_rank;
        }
        nfts[index] = nft;
      }
    }
  }
  return nfts;
}

WalletsRouter.get('/:address/assets', async (ctx: { params: { address: any; }; body: { total_value_in_usd?: number; total_value_in_eth?: number; balance?: number; erc20_balances?: { WETH: number; }; nfts?: any[]; params?: { total_value_in_usd: number; total_value_in_eth: number; balance: number; erc20_balances: { WETH: number; }; nfts: any[]; }; }; }) => {
  let address = ctx.params.address;
  let result = {
    total_value_in_usd: 0,
    total_value_in_eth: 0,
    balance: 0,
    erc20_balances: {
      WETH: 0
    },
    nfts: []
  }
  if (!ethers.utils.isAddress(address)) {
    ctx.body = result;
    return;
  }
  let balance = await provider.getBalance(address);
  result.balance = parseFloat(parseFloat(ethers.utils.formatUnits(balance, 'ether')).toFixed(4));
  result.total_value_in_eth = result.balance;

  const wethBalance = await erc20Contract.balanceOf(address);
  result.erc20_balances.WETH = parseFloat(parseFloat(ethers.utils.formatUnits(wethBalance, 'ether')).toFixed(4));
  result.total_value_in_eth += result.erc20_balances.WETH;



  result.nfts = await fetchNFTs(address);



  result.nfts = await setRank(result.nfts);

  result.total_value_in_eth = parseFloat(result.total_value_in_eth.toFixed(4));

  result.nfts = await setFloorPrice(result.nfts);
  if (result.nfts && result.nfts.length > 0) {
    for (const nft of result.nfts) {
      if (nft.floor_price > 0) {
        result.total_value_in_eth += nft.floor_price;
      }
    }
  }

  if (result.total_value_in_eth > 0) {
    const ethPrice = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD`);
    result.total_value_in_usd = parseFloat((result.total_value_in_eth * ethPrice.data.USD).toFixed(4));
  }
  ctx.body = {
    params: result
  }
});

module.exports = WalletsRouter;