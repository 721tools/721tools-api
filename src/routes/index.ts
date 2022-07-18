const Router = require('koa-router');
const orders = require('./orders');
const listing = require('./listing');

const router = new Router();

router.use('/api/orders', orders.routes(), orders.allowedMethods());
router.use('/api/listings', listing.routes(), listing.allowedMethods());

module.exports = router;