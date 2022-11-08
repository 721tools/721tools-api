import fs from "fs";
import path from "path";
import { ethers, BigNumber } from "ethers";

import { SignType } from '../../model/sign-type';

const genericErc721Abi = fs.readFileSync(path.join(__dirname, '../../abis/ERC721.json')).toString();

export const haveToken = async (provider, contractAddress, tokenId, address) => {
    const erc721Contract = new ethers.Contract(contractAddress, genericErc721Abi, provider);
    const owner = await erc721Contract.ownerOf(tokenId);
    return owner == ethers.utils.getAddress(address);
};


export const transferERC721 = async (signer, contractAddress, from, to, tokenId) => {
    return await signer.sendTransaction({
        to: contractAddress,
        gasLimit: BigNumber.from(21000),
        customData: {
            signType: SignType[SignType.WITHDRAW_ERC721], from: from, to: to, tokenId: tokenId
        },
    });
};
export const estimateTransferERC721 = async (provider, contractAddress, from, to, tokenId) => {
    const erc721Contract = new ethers.Contract(contractAddress, genericErc721Abi, provider);
    return await erc721Contract.estimateGas["safeTransferFrom(address,address,uint256)"](from, to, tokenId);
};