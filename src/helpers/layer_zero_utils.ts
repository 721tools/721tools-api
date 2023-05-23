import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const layerZeroAbi = fs.readFileSync(path.join(__dirname, '../abis/LayerZero.json')).toString();
const provider = new ethers.providers.JsonRpcProvider(process.env.NETWORK === 'goerli' ? process.env.GOERLI_RPC_URL : process.env.ETH_RPC_URL);
const contract = new ethers.Contract("0xbfD2135BFfbb0B5378b56643c2Df8a87552Bfa23", layerZeroAbi, provider);

export const estimateFees = async (userApplication, payload) => {
    const fees = await contract.estimateFees(10109, userApplication, payload, false, ethers.utils.solidityPack(["uint16", "uint256"], [1, 3500000]));
    return fees.nativeFee.mul(12).div(10);
}
