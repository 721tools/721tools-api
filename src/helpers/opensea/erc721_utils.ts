import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const genericErc721Abi = fs.readFileSync(path.join(__dirname, '../../abis/ERC721.json')).toString();

export const haveToken = async (signer, contractAddress, tokenId, address) => {
    const erc721Contract = new ethers.Contract(contractAddress, genericErc721Abi, signer);
    return (await erc721Contract.ownerOf(tokenId)) == ethers.utils.getAddress(address);
};


export const transferERC721 = async (signer, contractAddress, tokenId, from, to) => {
    const erc721Contract = new ethers.Contract(contractAddress, genericErc721Abi, signer);
    return await erc721Contract.safeTransferFrom(from, to, tokenId);
};