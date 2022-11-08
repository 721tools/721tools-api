import { ethers } from "ethers";
import axios from 'axios';

import { SignType } from '../../model/sign-type';

export class KmsSigner extends ethers.Signer {

    ethereumAddress = null;
    ownerAddress = null;

    constructor(ownerAddress, provider) {
        super();
        this.ownerAddress = ownerAddress;
        ethers.utils.defineReadOnly(this, "provider", provider || null);
    }

    connect(provider: ethers.providers.Provider): KmsSigner {
        return new KmsSigner(this.ownerAddress, provider);
    }

    getOwnerAddress = () => {
        return this.ownerAddress;
    }

    getAddress = async () => {
        if (!this.ethereumAddress) {
            try {
                const response = await axios.get(`${process.env.KMS_SIGNER_URL}/get-address?address=${this.ownerAddress}`, {
                    timeout: 10000
                });
                this.ethereumAddress = response.data.data
                return this.ethereumAddress;
            }
            catch (error) {
                if (error.response) {
                    console.error(`Get ${this.ownerAddress}'s robot address error`, (await error).response.data.message);
                } else {
                    console.error(`Get ${this.ownerAddress}'s robot address error`, error.toString());
                }

            }
        }
        return Promise.resolve(this.ethereumAddress);
    }

    signDigest = async (transaction) => {
        if (!transaction.customData || !transaction.customData.signType) {
            console.error(`Sign error, no sign type`);
            return null;
        }

        const signType = transaction.customData.signType;
        const signContent = {
            address: this.ownerAddress,
            signType: signType,
            to: transaction.to,
            value: transaction.value,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
            nonce: transaction.nonce,
            gasLimit: transaction.gasLimit,
            chainId: transaction.chainId,
            sendTo: null,
            type: transaction.type,
            data: transaction.data,
        }
        switch (signType) {
            case SignType[SignType.WITHDRAW_ETH]:
                if (transaction.to != this.ownerAddress) {
                    console.error(`Sign error, only can be sent to the owner`);
                    return null;
                }
                break;

            case SignType[SignType.OS_APPROVE_ERC20]:
                signContent.value = transaction.customData.value;
                break;

            case SignType[SignType.WITHDRAW_ERC20]:
                if (transaction.customData.to != this.ownerAddress) {
                    console.error(`Sign error, only can be sent to the owner`);
                    return null;
                }
                signContent.sendTo = transaction.customData.to;
                signContent.value = transaction.customData.amount;
                break;

            case SignType[SignType.WITHDRAW_ERC721]:
                if (transaction.customData.to != this.ownerAddress) {
                    console.error(`Sign error, only can be sent to the owner`);
                    return null;
                }
                signContent.sendTo = transaction.customData.to;
                signContent['from'] = transaction.customData.from;
                signContent['tokenId'] = transaction.customData.tokenId;
                break;
            case SignType[SignType.OS_BID]:
                signContent.data = transaction.data;
                break;

            default:
                console.error('Not known sign type!');
                return null;
        }

        try {
            console.log(signContent);
            const response = await axios.post(`${process.env.KMS_SIGNER_URL}/sign`, signContent, {
                timeout: 10000
            });
            return response.data.data;
        } catch (error) {
            if (error.response) {
                console.error(`Sign error,`, (await error).response.data.message);
            } else {
                console.error(`Sign error,`, error.toString());
            }
            return null;
        }
    }


    signMessage = async (message) => {
        return this.signDigest(message);
    }

    signTransaction = async (transaction) => {
        return await this.signDigest(transaction);
    }

}