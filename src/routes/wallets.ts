import Router from 'koa-router';
import { ethers } from "ethers";
import axios from 'axios';
import { curly } from 'node-libcurl';
import _ from 'underscore';
import Sequelize from 'sequelize';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

import { OpenseaCollections } from '../dal/db';
import genericErc20Abi from "../abis/ERC20.json";

const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
const erc20Contract = new ethers.Contract("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", genericErc20Abi, provider);

const WalletsRouter = new Router({})

const limiterFlexible = new RateLimiterMemory({
  points: 1,
  duration: 0.2,
})
const limiterQueue = new RateLimiterQueue(limiterFlexible);

const fetchItemsByOwner = async (owner: any, cursor: any) => {
  await limiterQueue.removeTokens(1);
  const url = `https://api.opensea.io/api/v1/assets?limit=200&owner=${owner}&order_direction=desc${cursor ? `&cursor=${cursor}` : ""}`;
  const { data } = await curly.get(url, {
    proxy: process.env.PROXY,
    sslVerifyPeer: 0,
    httpHeader: [
      'accept: application/json',
      'content-type: application/json',
      'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
    ]
  });
  return data;
}

const fetchNFTs = async (owner: any) => {
  let cursor = null;
  let hasNextPage = true;
  let items = [];
  const data = await fetchItemsByOwner(owner, cursor);
  if (data.previous) {
    cursor = data.previous;
  } else {
    hasNextPage = false;
  }
  Array.prototype.push.apply(items, _.map(data.assets.reverse(), (item: { token_id: any; collection: { slug: any; name: any; }; name: any; asset_contract: { schema_name: any; address: any; total_supply: any; }; image_url: any; last_sale: { payment_token: { eth_price: string; }; }; }) => ({
    token_id: item.token_id,
    slug: item.collection.slug,
    name: item.name ? item.name : `${item.collection.name} #${item.token_id}`,
    schema: item.asset_contract.schema_name,
    contract: item.asset_contract.address,
    total_supply: item.asset_contract.total_supply,
    image: item.image_url ? item.image_url : "",
    floor_price: 0,
    last_price: item.last_sale ? parseFloat(parseFloat(item.last_sale.payment_token.eth_price).toFixed(4)) : 0,
    rank: 0
  })));
  return items;
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

  result.total_value_in_eth = parseFloat(result.total_value_in_eth.toFixed(4));
  if (result.total_value_in_eth > 0) {
    const ethPrice = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD`);
    result.total_value_in_usd = parseFloat((result.total_value_in_eth * ethPrice.data.USD).toFixed(4));
  }

  // todo set and rank
  result.nfts = await fetchNFTs(address);
  if (result.nfts && result.nfts.length > 0) {
    const slugs = [...new Set(result.nfts.map(item => item.slug))];
    console.log(slugs);
    const collectionsRes = await OpenseaCollections.findAll({
      where: {
        slug: slugs
      }
    });

    if (collectionsRes && collectionsRes.length > 0) {
      const collectionMap = new Map<string, typeof OpenseaCollections>(collectionsRes.map((item: { slug: string; dataValues: any; }) => [item.slug, item.dataValues]));
      for (let index in result.nfts) {
        const nft = result.nfts[index];
        if (collectionMap.has(nft.slug)) {
          const collection = collectionMap.get(result.nfts[index].slug);
          nft.floor_price = collection.floor_price;
        }
      }
    }
  }

  ctx.body = {
    params: result
  }
});

module.exports = WalletsRouter;