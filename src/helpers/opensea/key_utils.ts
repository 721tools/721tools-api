export const randomKey = () => {
    const openseaKeys = process.env.OPENSEA_API_KEYS.split(",");
    return openseaKeys[Math.floor(Math.random() * openseaKeys.length)];
}