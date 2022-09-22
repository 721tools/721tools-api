import { HttpError } from '../model/http-error';
import { ethers } from "ethers";
import fs from "fs";
import { User } from '../dal/db';
import { UserType } from '../model/user-type';

export const requireLogin = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
            error: HttpError[HttpError.UNAUTHORIZED]
        };
        return;
    }
    const userId = ctx.session.siwe.user.id;
    const user = await User.findOne({
        where: {
            id: userId
        }
    });
    if (user.valid == 0) {
        ctx.session.siwe = null;
        ctx.session.nonce = null;
        ctx.status = 403;
        ctx.body = {
            error: HttpError[HttpError.USER_DISABLED]
        }
        return;
    }

    if (user.type !== UserType[UserType.LIFELONG] && user.expiration_time < new Date()) {
        ctx.session.siwe = null;
        ctx.session.nonce = null;
        ctx.status = 403;
        ctx.body = {
            error: HttpError[HttpError.USER_EXPIRED]
        }
        return;
    }

    ctx.session.siwe.user = user;

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

export const addressIsWhitelist = async (address) => {
    const whitelistAddress = fs.readFileSync(require.resolve('./address.txt'), "utf8").split(/\r?\n/);
    return whitelistAddress.includes(address);
}

export const isWhitelist = async (ctx) => {
    return await addressIsWhitelist(ctx.session.siwe.address);
}


export const requireWhitelist = async (ctx, next) => {
    if (!ctx.session.siwe) {
        ctx.status = 401;
        ctx.body = {
            error: HttpError[HttpError.UNAUTHORIZED]
        };
        return;
    }

    if (!isWhitelist(ctx)) {
        ctx.status = 403;
        ctx.body = {
            error: HttpError[HttpError.NOT_IN_WHITELIST]
        };
        return;
    }
    next();

}