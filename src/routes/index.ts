import Router from 'koa-router'
import orders from './orders'
import collections from './collections'
import sync from './sync'
import listing from './listing'


const router = new Router()

router.use('/api/orders', orders.routes(), orders.allowedMethods())
router.use('/api/collections', collections.routes(), collections.allowedMethods())
router.use('/api/sync', sync.routes(), sync.allowedMethods())
router.use('/api/listing', listing.routes(), listing.allowedMethods())


export default router;