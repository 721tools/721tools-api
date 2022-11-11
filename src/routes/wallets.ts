import Router from 'koa-router';
import { ethers } from "ethers";
import axios from 'axios';
import _ from 'underscore';
import Sequelize from 'sequelize';

import { OpenseaCollections, OpenseaItems } from '../dal/db';
import { parseTokenId, parseAddress } from "../helpers/binary_utils";
import { requireLogin, requireWhitelist } from "../helpers/auth_helper"
import { HttpError } from '../model/http-error';
import { SignType } from '../model/sign-type';
import { KmsSigner } from '../helpers/kms/kms-signer';
import { getERC20Balance, transferERC20, estimateTransferERC20 } from '../helpers/opensea/erc20_utils';
import { haveToken, transferERC721, estimateTransferERC721 } from '../helpers/opensea/erc721_utils';

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
          nft.image_url = collection.image_url;
          nft.collection_name = collection.name;
          nft.name = collection.name;
          nft.rank = 0;
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
          nft.image_url = item.image_url;
        } else {
          nft.name = nft.name + " #" + nft.token_id;
        }
        nfts[index] = nft;
      }
    }
  }
  return nfts;
}

const setNFTInfo = async (txs) => {
  if (txs && txs.length > 0) {
    const selectTokens = [];
    for (const tx of txs) {
      if (tx.type == 2) {
        selectTokens.push({
          "contract_address": parseAddress(tx.address),
          "token_id": parseTokenId(tx.value)
        });
      }
    }
    const itemsRes = await OpenseaItems.findAll({ where: { [Op.or]: selectTokens } });
    const collectionsRes = await OpenseaCollections.findAll({
      where: {
        contract_address: itemsRes.map(item => item.contract_address)
      }
    });


    if (itemsRes && itemsRes.length > 0) {
      const itemMap = new Map<string, typeof OpenseaItems>(itemsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex') + parseInt(item.token_id.toString("hex"), 16), item.dataValues]));
      const collctionMap = new Map<string, typeof OpenseaCollections>(collectionsRes.map((item) => ['0x' + Buffer.from(item.contract_address, 'binary').toString('hex'), item.dataValues]));

      for (let index in txs) {
        const nft = txs[index];
        if (itemMap.has(nft.address + nft.value)) {
          const item = itemMap.get(nft.address + nft.value);
          nft.rank = item.traits_rank;
          nft.image = item.image_url;
          nft.slug = item.slug;
          if (collctionMap.has(nft.address)) {
            nft.floor_price = collctionMap.get(nft.address).floor_price;
            nft.total_supply = collctionMap.get(nft.address).total_supply;
            nft.collection_name = collctionMap.get(nft.address).name;
          }
        }
        txs[index] = nft;
      }
    }
  }
  return txs;
}


WalletsRouter.get('/:address/assets', async (ctx) => {
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

  result.total_value_in_eth = parseFloat(result.total_value_in_eth.toFixed(4));

  result.nfts = await setFloorPrice(result.nfts);

  result.nfts = await setRank(result.nfts);

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




WalletsRouter.get('/:address/txs', async (ctx) => {
  let address = ctx.params.address;
  let result = {
    page: 0,
    limit: 0,
    total: 0,
    tx: []
  }

  if (!ethers.utils.isAddress(address)) {
    ctx.body = result;
    return;
  }

  let page = getNumberParam('page', ctx);
  let limit = getNumberParam('limit', ctx);
  if (limit <= 0) {
    limit = 10;
  }
  if (limit > 20) {
    limit = 20;
  }

  const walletRes = await axios.post(process.env.WALLET_RPC_URL, {
    method: "asset.get_user_tx",
    params:
    {
      wallet: address,
      page: page,
      limit: limit,
    },
    id: 2,
    jsonrpc: "2.0"
  });

  const walletResult = walletRes.data.result;
  result.page = walletResult.page;
  result.limit = walletResult.limit;
  result.total = walletResult.total;
  result.tx = walletResult.tx;

  result.tx = await setNFTInfo(result.tx);

  ctx.body = {
    params: result
  }
});

WalletsRouter.post('/withdraw', requireLogin, requireWhitelist, async (ctx) => {
  const type = ctx.request.body['type'];
  if (!type) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.BAD_REQUEST]
    }
    return;
  }

  const user = ctx.session.siwe.user;
  const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
  const signer = new KmsSigner(user.address, provider);
  if (type == "ETH") {
    const amount = ctx.request.body['amount'];
    if (!amount || amount <= 0) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.BAD_REQUEST]
      }
      return;
    }

    const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(user.smart_address)));
    if (balance < amount) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.INSUFFICIENT_BALANCE]
      }
      return;
    }

    const gasLimit = await provider.estimateGas({
      from: user.smart_address,
      to: user.address,
      value: ethers.utils.parseEther(amount.toString())
    });

    const feeData = await provider.getFeeData();

    const totalGas = parseFloat(ethers.utils.formatUnits(gasLimit.mul(feeData.gasPrice), 'ether'));
    if (amount < totalGas) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.AMOUNT_TOO_LOW]
      }
      return;
    }


    const tx = await signer.sendTransaction({
      to: user.address,
      value: ethers.utils.parseEther((amount - totalGas).toFixed(6)),
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      customData: { signType: SignType[SignType.WITHDRAW_ETH] },
    })

    ctx.body = { tx: tx.hash };
    return;
  }

  const contractAddress = ctx.request.body['contract_address'];
  if (!contractAddress) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.BAD_REQUEST]
    }
    return;
  }

  if (type == "ERC20") {
    const amount = ctx.request.body['amount'];
    if (!amount || amount <= 0) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.BAD_REQUEST]
      }
      return;
    }

    const erc20Balance = parseFloat(ethers.utils.formatEther(await getERC20Balance(provider, contractAddress, user.smart_address)));
    if (erc20Balance < amount) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.INSUFFICIENT_BALANCE]
      }
      return;
    }

    const tx = await transferERC20(signer, contractAddress, user.address, ethers.utils.parseEther(amount.toString()));
    ctx.body = { tx: tx.hash };
    return;
  }

  const tokenId = ctx.request.body['token_id'];
  if (!tokenId) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.BAD_REQUEST]
    }
    return;
  }

  if (type == "ERC721") {
    if (! await haveToken(provider, contractAddress, tokenId, user.smart_address)) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.DONT_HAVE_TOKEN]
      }
      return;
    }

    const tx = await transferERC721(signer, contractAddress, user.smart_address, user.address, tokenId);
    ctx.body = { tx: tx.hash };
    return;


  } else if (type == "ERC1155") {
    //   const withdrawERC1155 = async (contractAddress, tokenIds, quantities) => {
    //     const iface = new ethers.utils.Interface(genericErc1155Abi);
    //     const calldata = iface.encodeFunctionData("safeBatchTransferFrom", [address, signer.getOwnerAddress(), tokenIds, quantities, "0x"]);
    //     const tx = await signer.sendTransaction({ to: contractAddress, data: calldata });
    //     const tr = await tx.wait();
    //     console.log(tr);
    // }
  }

});

WalletsRouter.post('/withdraw/estimate_gas', requireLogin, requireWhitelist, async (ctx) => {
  const type = ctx.request.body['type'];
  if (!type) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.BAD_REQUEST]
    }
    return;
  }

  const user = ctx.session.siwe.user;
  const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
  if (type == "ETH") {
    const amount = ctx.request.body['amount'];
    if (!amount || amount <= 0) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.BAD_REQUEST]
      }
      return;
    }

    const balance = parseFloat(ethers.utils.formatEther(await provider.getBalance(user.smart_address)));
    if (balance < amount) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.INSUFFICIENT_BALANCE]
      }
      return;
    }
    const gasLimit = await provider.estimateGas({
      from: user.smart_address,
      to: user.address,
      value: ethers.utils.parseEther(amount.toString())
    });

    ctx.body = await getGas(provider, gasLimit);
    return;
  }


  const contractAddress = ctx.request.body['contract_address'];
  if (!contractAddress) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.BAD_REQUEST]
    }
    return;
  }

  if (type == "ERC20") {
    const amount = ctx.request.body['amount'];
    if (!amount || amount <= 0) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.BAD_REQUEST]
      }
      return;
    }

    const erc20Balance = parseFloat(ethers.utils.formatEther(await getERC20Balance(provider, contractAddress, user.smart_address)));
    if (erc20Balance < amount) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.INSUFFICIENT_BALANCE]
      }
      return;
    }

    const gasLimit = await estimateTransferERC20(provider, contractAddress, user.address, amount);
    ctx.body = await getGas(provider, gasLimit);
    return;
  }

  const tokenId = ctx.request.body['token_id'];
  if (!tokenId) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.BAD_REQUEST]
    }
    return;
  }

  if (type == "ERC721") {
    if (! await haveToken(provider, contractAddress, tokenId, user.smart_address)) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.DONT_HAVE_TOKEN]
      }
      return;
    }

    const gasLimit = await estimateTransferERC721(provider, contractAddress, user.smart_address, user.address, tokenId);
    ctx.body = await getGas(provider, gasLimit);
    return;


  } else if (type == "ERC1155") {
    //   const withdrawERC1155 = async (contractAddress, tokenIds, quantities) => {
    //     const iface = new ethers.utils.Interface(genericErc1155Abi);
    //     const calldata = iface.encodeFunctionData("safeBatchTransferFrom", [address, signer.getOwnerAddress(), tokenIds, quantities, "0x"]);
    //     const tx = await signer.sendTransaction({ to: contractAddress, data: calldata });
    //     const tr = await tx.wait();
    //     console.log(tr);
    // }
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

const getGas = async (provider, gasLimit) => {
  const gasPrice = await provider.getGasPrice();

  const totalGas = parseFloat(parseFloat(ethers.utils.formatUnits(gasLimit.mul(gasPrice), 'ether')).toFixed(6));
  return { gas_limit: gasLimit.toNumber(), gas_price: gasPrice.toNumber(), totalGas: totalGas };
}

module.exports = WalletsRouter;