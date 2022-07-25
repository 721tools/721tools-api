import Router from 'koa-router';
import { ethers } from "ethers";
import axios from 'axios'
import genericErc20Abi from "../abis/ERC20.json";

const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
const erc20Contract = new ethers.Contract("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", genericErc20Abi, provider);

const WalletsRouter = new Router({})
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

  ctx.body = {
    params: result
  }
});

module.exports = WalletsRouter;