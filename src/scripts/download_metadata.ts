
const ethers = require('ethers');

const genericErc721Abi = require("../abis/ERC721.json");

const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.alchemyapi.io/v2/nFvCkBjYskYZdpdXO1bnNW1epn6Muz7G");

const downloadMetadata = async (contract_address) => {
    const contract = new ethers.Contract(contract_address, genericErc721Abi, provider);
    const name = await contract.name();
    const totalSupply = parseInt((await contract.totalSupply()).toString());

    let firstTokenIndex = 0;
    try {
        const tokenURI = await contract.tokenURI(0);
    } catch (err) {
        firstTokenIndex = 1;
    }
    const tokenURI = await contract.tokenURI(firstTokenIndex);
    console.log(tokenURI)

    const tokenURIPattern = tokenURI.replace(firstTokenIndex, "{}");
    console.log(tokenURIPattern);

};

downloadMetadata("0xc599f72644140fe4d00ef9574100f636a30d923d");