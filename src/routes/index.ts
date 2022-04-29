import Router from 'koa-router'
import orders from './orders'
import tokens from './tokens'
import collections from './collections'
import sync from './sync'

const router = new Router()

router.use('/api/orders', orders.routes(), orders.allowedMethods())
router.use('/api/collections', collections.routes(), collections.allowedMethods())
router.use('/api', tokens.routes(), tokens.allowedMethods())
router.use('/api/sync', sync.routes(), sync.allowedMethods())


export default router;