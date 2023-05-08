interface ContractInfo {
    name: string;
    goerli_platform_number: number;
    ethereum_platform_number: number;
}

export const markets: { [key: string]: ContractInfo } = {
    '0x00000000006c3852cbEf3e08E8dF289169EdE581': {
        name: 'Seaport 1.1',
        goerli_platform_number: 10,
        ethereum_platform_number: 0,
    },
    '0x00000000000001ad428e4906aE43D8F9852d0dD6': {
        name: 'Seaport 1.4',
        goerli_platform_number: 13,
        ethereum_platform_number: 0,
    },
    '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC': {
        name: 'Seaport 1.5',
        goerli_platform_number: 11,
        ethereum_platform_number: 0,
    },
    '0x000000000000Ad05Ccc4F10045630fb830B95127': {
        name: 'Blur',
        goerli_platform_number: 12,
        ethereum_platform_number: 0,
    },
};
