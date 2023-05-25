interface ContractInfo {
    goerli_platform: number;
    goerli_cross_platform: number;
    ethereum_platform: number;
    ethereum_cross_platform: number;
}

export const CONTRACTS: { [key: string]: string } = {
    "0x00000000006c3852cbEf3e08E8dF289169EdE581": "Seaport1_1",
    "0x00000000000001ad428e4906aE43D8F9852d0dD6": "Seaport_1_4",
    "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC": "Seaport_1_5",
    "0x000000000000Ad05Ccc4F10045630fb830B95127": "Blur",
}

export const MARKETS: { [key: string]: ContractInfo } = {
    'Seaport1_1': {
        goerli_platform: 10,
        goerli_cross_platform: 0,
        ethereum_platform: 0,
        ethereum_cross_platform: 0,
    },
    'Seaport_1_4': {
        goerli_platform: 13,
        goerli_cross_platform: 0,
        ethereum_platform: 0,
        ethereum_cross_platform: 0,
    },
    'Seaport_1_5': {
        goerli_platform: 14,
        goerli_cross_platform: 17,
        ethereum_platform: 0,
        ethereum_cross_platform: 0,
    },
    'Blur': {
        goerli_platform: 12,
        goerli_cross_platform: 0,
        ethereum_platform: 0,
        ethereum_cross_platform: 0,
    },
};

export const getPlatform = (protocalAddress, network, crossChain) => {
    let plateform = 0;
    if (!CONTRACTS[protocalAddress]) {
        return plateform;
    }
    const market = MARKETS[CONTRACTS[protocalAddress]];
    if (network === 'goerli') {
        if (crossChain) {
            plateform = market.goerli_cross_platform;
        } else {
            plateform = market.goerli_platform;
        }
    } else {
        if (crossChain) {
            plateform = market.ethereum_cross_platform;
        } else {
            plateform = market.ethereum_platform;
        }
    }
    return plateform;
}