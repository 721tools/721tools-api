const Koa = require('koa');
const httpRouter = require('./routes');
const cors = require('koa2-cors');
const bodyParser = require('koa-body-parser');
const session = require('koa-session');

require('./config/env');

const app = new Koa();
const port = process.env.SERVER_PORT || 3000;

app.keys = ['R3yorirLUoKFEJ7aluibXHIs8VVUOHWUUN', '7YVtyQ85AuGKFYhMbr9fLDPwawytdDS9EF'];

app.use(cors());
app.use(bodyParser());

app.use(session({
  key: '721:sess',
  maxAge: 86400000,
  overwrite: true,
}, app));

app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url}`);
  await next();
});

app.use(async (ctx, next) => {
  const start = new Date().getTime();
  await next();
  const ms = new Date().getTime() - start;
  console.log(`Time: ${ms}ms`);
});

app.use(httpRouter.routes()).use(httpRouter.allowedMethods());

app.listen(port);

console.log(`server start at http://localhost:${port}/`);