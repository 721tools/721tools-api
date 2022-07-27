const Router = require('koa-router');
const orders = require('./orders');
const listing = require('./listing');
const wallets = require('./wallets');
const smartBuys = require('./smart-buys');

const router = new Router();

router.use('/api/orders', orders.routes(), orders.allowedMethods());
router.use('/api/listings', listing.routes(), listing.allowedMethods());
router.use('/api/wallets', wallets.routes(), wallets.allowedMethods());
router.use('/api/smart-buys', smartBuys.routes(), smartBuys.allowedMethods());

module.exports = router;