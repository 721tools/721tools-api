import { gotScraping } from 'got-scraping';
import { randomKey } from './key_utils';

export const getOrders = async (openseaTokens, contractAddress) => {
    let url = `https://${process.env.NETWORK === 'goerli' ? "testnets-" : ""}api.opensea.io/v2/orders/${process.env.NETWORK === 'goerli' ? "goerli" : "ethereum"}/seaport/listings?asset_contract_address=${contractAddress}&limit=50&order_by=eth_price&order_direction=asc&format=json`;
    for (const openseaToken of openseaTokens) {
        url = url + "&token_ids=" + openseaToken.token_id;
    }
    console.log(url);
    const key = randomKey();
    let hasMore = true;
    let cursor = null;
    let allOrders = [];
    while (hasMore) {
        const requestUrl = cursor ? url + `&cursor=${cursor}` : url;
        const response = await gotScraping({
            url: requestUrl,
            headers: {
                'content-type': 'application/json',
                'X-API-KEY': key
            },
        });
        if (response.statusCode != 200) {
            console.log(`Get opensea listings error, using key:${key}, url:${requestUrl}`, response.body);
            return [];
        }
        const responseBody = JSON.parse(response.body);
        const orders = responseBody.orders;
        cursor = responseBody.next;
        if (!cursor) {
            hasMore = false;
        }
        if (orders.length > 0) {
            allOrders = allOrders.concat(orders);
        }
    }
    return allOrders;
}
