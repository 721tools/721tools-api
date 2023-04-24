const { ClickHouse } = require('clickhouse');
require('../config/env');

const clickhouse = new ClickHouse({
    url: process.env.CLICKHOUSE_URL,
    port: 8123,
    debug: false,
    basicAuth: {
        username: process.env.CLICKHOUSE_USERNAME,
        password: process.env.CLICKHOUSE_PASSWORD,
    },
    isUseGzip: false,
    trimQuery: false,
    usePost: false,
    format: "json",
    raw: false,
    config: {
        // session_id                              : '',
        session_timeout: 60,
        output_format_json_quote_64bit_integers: 0,
        enable_http_compression: 0,
        database: '721_nft_assets',
    },
});

module.exports = clickhouse;