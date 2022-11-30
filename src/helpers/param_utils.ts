export const getNumberQueryParam = (param, ctx) => {
    let paramValue: number = 0;
    if (param in ctx.request.query) {
        paramValue = Number(ctx.request.query[param]);
        if (paramValue < 0) {
            paramValue = 0;
        }
    }
    return paramValue;
};

export const getNumberParam = (param, ctx) => {
    let paramValue: number = 0;
    if (param in ctx.request.body) {
        paramValue = Number(ctx.request.body[param]);
        if (paramValue < 0) {
            paramValue = 0;
        }
    }
    return paramValue;
};
