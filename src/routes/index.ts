const Router = require('koa-router');
const auth = require('./auth');
const listing = require('./listing');
const wallets = require('./wallets');
const smartBuys = require('./smart-buys');
const collections = require('./collections');
const statistics = require('./statistics');


const router = new Router();

router.use('/api/listings', listing.routes(), listing.allowedMethods());
router.use('/api/wallets', wallets.routes(), wallets.allowedMethods());
router.use('/api/smart-buys', smartBuys.routes(), smartBuys.allowedMethods());
router.use('/api/collections', collections.routes(), collections.allowedMethods());
router.use('/api/statistics', statistics.routes(), statistics.allowedMethods());
router.use('/api/auth', auth.routes(), auth.allowedMethods());

module.exports = router;