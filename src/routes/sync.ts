import Router from 'koa-router'

const router = new Router({})

const ethers = require('ethers');
import genericErc721Abi from "../abis/ERC721.json";
import collection from '../entity/collection';

const provider = new ethers.providers.JsonRpcProvider("https://eth-mainnet.alchemyapi.io/v2/nFvCkBjYskYZdpdXO1bnNW1epn6Muz7G");

const downloadMetadata = async (contract_address) => {
  const contract = new ethers.Contract(contract_address, genericErc721Abi, provider);
  const name = await contract.name();
  const totalSupply = parseInt((await contract.totalSupply()).toString());

  let firstTokenIndex = 0;
  let tokenURI = "";
  try {
    tokenURI = await contract.tokenURI(firstTokenIndex);
  } catch (err) {
    firstTokenIndex = 1;
    tokenURI = await contract.tokenURI(firstTokenIndex);
  }
  console.log(tokenURI)
  const tokenURIPattern = tokenURI.replace(firstTokenIndex.toString(), "{}");


  console.log(tokenURIPattern);

  const res = await collection.findAll();
  console.log(res);

};


router.get('/', async (ctx) => {
  downloadMetadata("0xc599f72644140fe4d00ef9574100f636a30d923d");
  ctx.body = "OK";
});

export default router