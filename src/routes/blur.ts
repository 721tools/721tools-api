import Router from "koa-router";
import { gotScraping } from 'got-scraping';

const BlurRouter = new Router({});
BlurRouter.post("/auth/:slug", async (ctx) => {
  const response = await gotScraping({
    url: `https://core-api.prod.blur.io/auth/${ctx.params.slug}`,
    body: JSON.stringify(ctx.request.body),
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });
  ctx.set("content-type", response.headers['content-type'])
  ctx.status = response.statusCode;
  ctx.body = response.body;
});

module.exports = BlurRouter;
