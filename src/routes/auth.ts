import { generateNonce, SiweMessage } from 'siwe';
import { ethers } from 'ethers';
import Router from 'koa-router';

const AuthRouter = new Router({})
AuthRouter.get('/nonce', async (ctx) => {

  ctx.session.nonce = generateNonce();
  ctx.body = {
    nonce: ctx.session.nonce
  }

});

module.exports = AuthRouter;