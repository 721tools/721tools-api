import Router from 'koa-router';
import { ethers } from "ethers";
import axios from 'axios';
import _ from 'underscore';
import Sequelize from 'sequelize';

import { OpenseaCollections, OpenseaItems } from '../dal/db';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";

const WalletsRouter = new Router({});
const Op = Sequelize.Op;

const setFloorPrice = async (nfts) => {
  if (nfts && nfts.length > 0) {
    const contractAddresses = [...new Set(nfts.map(item => parseAddress(item.token_address)))];
    const collectionsRes = await OpenseaCollections.findAll({
      where: {
        contract_address: contractAddresses
      }
    });

    if (collectionsRes && collectionsRes.length > 0) {
      const collectionMap = new Map<string, typeof OpenseaCollections>(collectionsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex'), item.dataValues]));
      for (let index in nfts) {
        const nft = nfts[index];
        if (collectionMap.has(nft.token_address)) {
          const collection = collectionMap.get(nft.token_address);
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
        "contract_address": parseAddress(nft.token_address),
        "token_id": parseTokenId(nft.token_id)
      });
    }
    const itemsRes = await OpenseaItems.findAll({ where: { [Op.or]: selectTokens } });

    if (itemsRes && itemsRes.length > 0) {
      const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex') + parseInt(item.token_id.toString("hex"), 16), item.dataValues]));
      for (let index in nfts) {
        const nft = nfts[index];
        if (itemMap.has(nft.token_address + nft.token_id)) {
          const item = itemMap.get(nft.token_address + nft.token_id);
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

  const walletRes = await axios.post(process.env.WALLET_RPC_URL, {
    method: "asset.get_user_balance",
    params: [
      {
        wallet: address
      }
    ],
    id: 2,
    jsonrpc: "2.0"
  });

  const walletResult = walletRes.data.result;

  let balance = walletResult.eth_balance;
  result.balance = parseFloat(parseFloat(ethers.utils.formatUnits(balance, 'ether')).toFixed(4));
  result.total_value_in_eth = result.balance;

  let wethBalance = 0;
  for (const erc20 of walletResult.erc20) {
    if (ethers.utils.getAddress(erc20.token_address) == "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
      wethBalance = erc20.balance;
    }
  }

  result.erc20_balances.WETH = parseFloat(parseFloat(ethers.utils.formatUnits(wethBalance, 'ether')).toFixed(4));
  result.total_value_in_eth += result.erc20_balances.WETH;

  result.nfts = walletResult.erc721;

  result.nfts = await setRank(result.nfts);

  result.total_value_in_eth = parseFloat(result.total_value_in_eth.toFixed(4));

  result.nfts = await setFloorPrice(result.nfts);
  if (result.nfts && result.nfts.length > 0) {
    for (const nft of result.nfts) {
      if (nft.floor_price > 0) {
        result.total_value_in_eth += (nft.floor_price * nft.balance);
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