import { generateNonce, SiweMessage, ErrorTypes } from "siwe";
import { ethers } from "ethers";

export const requireLogin = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
        message: "You have to first sign_in"
        };
        return;
    }
    next();
}

export const requireMember = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
        message: "You have to first sign_in"
        };
        return;
    }

    const abi = [
        "function balanceOf(address) view returns (uint256)",
      ];

    const address = ctx.session.siwe.address;

    const memberShipAddress = process.env.MEMBER_SHIP_ADDRESS;

    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
    const wallet = ethers.Wallet.createRandom();
    const account = wallet.connect(provider);

    const nft = new ethers.Contract(memberShipAddress, abi, account);

    const balance = await nft.balanceOf(address);
    if (balance.toNumber() === 0) {
        ctx.status = 401;
        ctx.body = {
        message: "You are not a member"
        };
        return;
    }
    next();

}