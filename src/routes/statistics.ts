import Router from 'koa-router';
import { HttpError } from '../model/http-error';

const clickhouse = require('../dal/clickhouse');

const StatisticsRouter = new Router({})
StatisticsRouter.get('/sell_count', async (ctx) => {
    let contract_address = ctx.request.query.contract_address;
    if (!contract_address) {
        ctx.status = 404;
        ctx.body = {
          error: HttpError[HttpError.NO_COLLECTION_FOUND]
        }
        return;
    }

    contract_address = escape(contract_address).substring(2).toUpperCase();

    const query = `select count(*) as count from nft_sales where fulfiller_token_string = '${contract_address}'`;

    const row = await clickhouse.query(query).toPromise();
    ctx.body = {
        data: row[0].count
      }
});
module.exports = StatisticsRouter;