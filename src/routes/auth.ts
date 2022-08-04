import { generateNonce, SiweMessage, ErrorTypes } from "siwe";
import Router from "koa-router";
import { HttpError } from '../model/http-error';
import { requireLogin, requireMember } from "../helpers/auth_helper"

const AuthRouter = new Router({});
AuthRouter.get("/nonce", async (ctx) => {
  ctx.session.nonce = generateNonce();
  ctx.body = {
    nonce: ctx.session.nonce,
  };
});

AuthRouter.get("/me", requireLogin, async (ctx) => {
  ctx.body = {
    address: ctx.session.siwe.address
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
    console.log(fields)
    // ctx.session.cookie.expires = new Date(fields.expirationTime);
    ctx.body = {}
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
