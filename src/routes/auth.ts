import { generateNonce, SiweMessage, ErrorTypes } from "siwe";
import Router from "koa-router";
import axios from 'axios';
import { HttpError } from '../model/http-error';
import { requireLogin, requireWhitelist, requireMember, isWhitelist, addressIsWhitelist } from "../helpers/auth_helper"
import { User } from '../dal/db';
import { UserType } from '../model/user-type';



const AuthRouter = new Router({});
AuthRouter.get("/nonce", async (ctx) => {
  ctx.session.nonce = generateNonce();
  ctx.body = {
    nonce: ctx.session.nonce,
  };
});

AuthRouter.get("/me", requireLogin, async (ctx) => {
  const user = ctx.session.siwe.user;
  ctx.body = {
    address: user.address,
    smart_address: user.smart_address,
    type: user.type,
    last_login_time: user.last_login_time.getTime(),
    expiration_time: user.expiration_time.getTime(),
    create_time: user.create_time.getTime(),
  }
})

AuthRouter.post("/login", async (ctx) => {
  try {
    if (!ctx.request.body.message) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.NOT_VALID_PRE_MESSAGE]
      }
      return;
    }

    let message = new SiweMessage(ctx.request.body.message);
    const fields = await message.validate(ctx.request.body.signature);
    if (fields.nonce !== ctx.session.nonce) {
      ctx.status = 400;
      ctx.body = {
        error: HttpError[HttpError.NOT_VALID_NONCE]
      };
      return;
    }
    ctx.session.siwe = fields;
    const address = fields.address;
    let user = await User.findOne({
      where: {
        address: address
      }
    });
    const now = new Date();
    if (!user) {
      let smart_address = '';
      if (await addressIsWhitelist(address)) {
        try {
          const response = await axios.post(`${process.env.KMS_SIGNER_URL}/create-wallet`, {
            address: address,
          }, {
            timeout: 10000
          });
          smart_address = response.data.data;
        } catch (err) {
          console.error(`${address} create smart wallet error`, err);
          ctx.status = 500;
          ctx.body = {
            error: HttpError[HttpError.INTERNAL_SERVER_RROR],
          }
          return;
        }

      }
      user = await User.create({
        address: address,
        smart_address: smart_address,
        valid: 1,
        type: UserType[UserType.LIFELONG],
        last_login_time: now,
        expiration_time: now,
        create_time: now,
      });
    } else {
      if (user.valid == 0) {
        ctx.session.siwe = null;
        ctx.session.nonce = null;
        ctx.status = 403;
        ctx.body = {
          error: HttpError[HttpError.USER_DISABLED]
        }
        return;
      }

      if (user.type !== UserType[UserType.LIFELONG] && user.expiration_time < now) {
        ctx.session.siwe = null;
        ctx.session.nonce = null;
        ctx.status = 403;
        ctx.body = {
          error: HttpError[HttpError.USER_EXPIRED]
        }
        return;
      }


      await User.update({
        last_login_time: now,
      }, {
        where: {
          id: user.id
        }
      });
    }

    user.last_login_time = now;

    ctx.session.siwe.user = user;
    ctx.body = {
      address: user.address,
      smart_address: user.smart_address,
      type: user.type,
      last_login_time: user.last_login_time.getTime(),
      expiration_time: user.expiration_time.getTime(),
      create_time: user.create_time.getTime(),
    }
  } catch (e) {
    ctx.session.siwe = null;
    ctx.session.nonce = null;
    switch (e) {
      case ErrorTypes.EXPIRED_MESSAGE: {
        ctx.status = 400;
        ctx.body = {
          error: HttpError[HttpError.NOT_VALID_NONCE],
          message: e.message,
        }
        break;
      }
      case ErrorTypes.INVALID_SIGNATURE: {
        ctx.status = 400;
        ctx.body = {
          error: HttpError[HttpError.NOT_VALID_NONCE],
          message: e.message,
        }
        break;
      }
      default: {
        ctx.status = 400;
        ctx.body = {
          error: HttpError[HttpError.NOT_VALID_NONCE],
          message: e.message,
        }
        break;
      }
    }
  }
});

module.exports = AuthRouter;
