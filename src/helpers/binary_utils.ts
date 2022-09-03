export const parseAddress = (address) => {
    return Buffer.from(address.slice(2), 'hex');
}

export const parseTokenId = (tokenId) => {
    let hex = parseInt(tokenId).toString(16);
    if (hex.length % 2 == 1) {
        hex = '0' + hex;
    }
    return Buffer.from(hex, 'hex');
};