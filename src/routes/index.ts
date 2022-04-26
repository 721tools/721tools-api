import Router from 'koa-router'
import orders from './orders'
import tokens from './tokens'

const router = new Router()

router.use('/api/orders', orders.routes(), orders.allowedMethods())
router.use('/api', tokens.routes(), tokens.allowedMethods())


export default router;