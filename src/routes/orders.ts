import Router from 'koa-router';

const OrdersRouter = new Router({})
OrdersRouter.post('/', async (ctx) => {
  const postData = ctx.request.body
  console.log(postData)
});

module.exports = OrdersRouter;