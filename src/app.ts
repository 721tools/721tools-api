import Koa from 'koa';
import './config/env';
import router from './routes';
const cors = require('koa2-cors');
const bodyParser = require('koa-body-parser');

const app = new Koa();
const port = process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(bodyParser());

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

app.use(router.routes()).use(router.allowedMethods());

app.listen(port);

console.log(`server start at http://localhost:${port}/`);
