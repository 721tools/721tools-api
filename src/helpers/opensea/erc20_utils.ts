import fs from "fs";
import path from "path";
import { ethers, BigNumber } from "ethers";

const genericErc20Abi = fs.readFileSync(path.join(__dirname, '../../abis/ERC20.json')).toString();

const OpenSeaConduitAddress = "0x1E0049783F008A0085193E00003D00cd54003c71";

// [Mainnet Ethereum] WETH address: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
// [Ropsten Testnet] WETH address: 0xc778417E063141139Fce010982780140Aa0cD5Ab
// [Rinkeby Testnet] WETH address: 0xc778417E063141139Fce010982780140Aa0cD5Ab
// [Kovan Testnet] WETH address: 0xd0A1E359811322d97991E03f863a0C30C2cF029C
// [Goerli Testnet] WETH address: 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6

export const getWethAllowance = async (signer, address) => {
    const erc20Contract = new ethers.Contract(getWethAddress(), genericErc20Abi, signer);
    return await erc20Contract.allowance(address, OpenSeaConduitAddress);
};

export const getWethBalance = async (signer, address) => {
    const erc20Contract = new ethers.Contract(getWethAddress(), genericErc20Abi, signer);
    return await erc20Contract.balanceOf(address);
};

export const getERC20Balance = async (signer, contractAddress, address) => {
    const erc20Contract = new ethers.Contract(contractAddress, genericErc20Abi, signer);
    return await erc20Contract.balanceOf(address);
};

export const approveWeth = async (signer) => {
    const erc20Contract = new ethers.Contract(getWethAddress(), genericErc20Abi, signer);
    return await erc20Contract.approve(OpenSeaConduitAddress, BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935"));
};

export const transferERC20 = async (signer, contractAddress, address, amount) => {
    const erc20Contract = new ethers.Contract(contractAddress, genericErc20Abi, signer);
    return await erc20Contract.transfer(address, ethers.utils.parseEther(amount.toString()));
};

export const estimateTransferERC20 = async (signer, contractAddress, address, amount) => {
    const erc20Contract = new ethers.Contract(contractAddress, genericErc20Abi, signer);
    return await erc20Contract.estimateGas.transfer(address, ethers.utils.parseEther(amount.toString()));
};


const getWethAddress = () => {
    return process.env.NETWORK === 'goerli' ? "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6" : "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
}