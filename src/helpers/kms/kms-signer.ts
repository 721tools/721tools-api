import { ethers } from "ethers";
import axios from 'axios';

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

    signDigest = async (digestString) => {
        try {
            const response = await axios.post(`${process.env.KMS_SIGNER_URL}/sign`, {
                address: this.ownerAddress,
                data: digestString
            }, {
                timeout: 10000
            });
            return response.data.data;
        } catch (error) {
            if (error.response) {
                console.error(`Sign error`, (await error).response.data.message);
            } else {
                console.error(`Sign error`, error.toString());
            }
            return null;
        }
    }


    signMessage = async (message) => {
        return this.signDigest(ethers.utils.hashMessage(message));
    }

    signTransaction = async (transaction) => {
        console.log(transaction);
        const unsignedTx = await ethers.utils.resolveProperties(transaction);
        const serializedTx = ethers.utils.serializeTransaction(unsignedTx);
        const transactionSignature = await this.signDigest(ethers.utils.keccak256(serializedTx));
        return ethers.utils.serializeTransaction(unsignedTx, transactionSignature);
    }

}