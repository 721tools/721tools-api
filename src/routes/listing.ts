import Router from 'koa-router'

const router = new Router({})
router.post('/', async (ctx) => {
  const postData = ctx.request.body
  console.log(postData)
});

export default router