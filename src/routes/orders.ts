import Router from 'koa-router';
import { OpenseaCollections } from '../dal/db';
import { HttpError } from '../model/http-error';
import { parseAddress } from '../helpers/binary_utils';
import { requireLogin } from "../helpers/auth_helper";
import _ from 'lodash';

const OrdersRouter = new Router({})

OrdersRouter.post('/sweep', requireLogin, async (ctx) => {
  if (!('contract_address' in ctx.request.body)) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }
  const contract_address = ctx.request.body['contract_address'];
  if (!contract_address) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }

  const collection = await OpenseaCollections.findOne({
    where: {
      contract_address: parseAddress(contract_address)
    }
  });

  if (!collection) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }
  if (collection.status == 1) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.NOT_VALID_CONTRACT_ADDRSS]
    }
    return;
  }

  const tokens = ctx.request.body['tokens'];
  if (!tokens || tokens.length == 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.EMPTY_TOKENS]
    }
  }
  if (tokens.length > 0) {
    ctx.status = 400;
    ctx.body = {
      error: HttpError[HttpError.TOO_MANY_TOKENS]
    }
  }

  ctx.body = ctx.request.body;
});


module.exports = OrdersRouter;