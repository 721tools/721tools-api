import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const genericErc20Abi = fs.readFileSync(path.join(__dirname, '../../abis/ERC20.json')).toString();

// [Mainnet Ethereum] WETH address: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
// [Ropsten Testnet] WETH address: 0xc778417E063141139Fce010982780140Aa0cD5Ab
// [Rinkeby Testnet] WETH address: 0xc778417E063141139Fce010982780140Aa0cD5Ab
// [Kovan Testnet] WETH address: 0xd0A1E359811322d97991E03f863a0C30C2cF029C

export const getWethAllowance = async (signer, address) => {
    const erc20Contract = new ethers.Contract(getWethAddress(), genericErc20Abi, signer);
    return await erc20Contract.allowance(address, "0x1E0049783F008A0085193E00003D00cd54003c71");
};

export const getWethBalance = async (signer, address) => {
    const erc20Contract = new ethers.Contract(getWethAddress(), genericErc20Abi, signer);
    return await erc20Contract.balanceOf(address);
};

const getWethAddress = () => {
    return process.env.NETWORK === 'rinkeby' ? "0xc778417E063141139Fce010982780140Aa0cD5Ab" : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
}