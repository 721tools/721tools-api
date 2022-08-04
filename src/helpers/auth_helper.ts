import { HttpError } from '../model/http-error';
import { ethers } from "ethers";
import fs from "fs";

export const requireLogin = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
            error: HttpError[HttpError.UNAUTHORIZED]
        };
        return;
    }
    next();
}

export const requireMember = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
            error: HttpError[HttpError.UNAUTHORIZED]
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
        ctx.status = 403;
        ctx.body = {
            error: HttpError[HttpError.UNAUTHORIZED]
        };
        return;
    }
    next();

}


export const requireWhitelist = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
            error: HttpError[HttpError.UNAUTHORIZED]
        };
        return;
    }

    const address = ctx.session.siwe.address;
    const whitelistAddress = fs.readFileSync("address.txt", "utf8").split(/\r?\n/);

    if (!whitelistAddress.includes(address)) {
        ctx.status = 403;
        ctx.body = {
            error: HttpError[HttpError.NOT_IN_WHITELIST]
        };
        return;
    }
    next();

}