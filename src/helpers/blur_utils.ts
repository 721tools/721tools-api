import fs from "fs";
import path from "path";
import { ethers } from 'ethers';
import { gotScraping } from 'got-scraping';

const blurAbi = fs.readFileSync(path.join(__dirname, '../abis/Blur.json')).toString();
const blurProxyAbi = fs.readFileSync(path.join(__dirname, '../abis/BlurProxy.json')).toString();

export const decode = (input) => {
    const key = "XTtnJ44LDXvZ1MSjdyK4pPT8kg5meJtHF44RdRBGrsaxS6MtG19ekKBxiXgp";
    const bytes = Buffer.from(input, "base64").toString("utf-8");
    let result = "";
    for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result;
}

export const parseCalldata = (calldata) => {
    const iface = new ethers.utils.Interface(blurAbi);
    const parsedData = iface.parseTransaction({ data: calldata });
    let args = parsedData.args;
    if (parsedData.name == "execute") {
        args = [[args]];
    }
    const blurProxyIface = new ethers.utils.Interface(blurProxyAbi);
    return blurProxyIface.encodeFunctionData("buyAssetsForEth", args);
}

export const getAuthToken = async () => {
    const fileName = "blur_token.txt";
    if (fs.existsSync(fileName)) {
        const fileContent = fs.readFileSync(fileName).toString();
        if (fileContent || fileContent.length > 0) {
            const storage = JSON.parse(fileContent);
            if (Date.now() - storage.timestamp < 24 * 60 * 60 * 1000) {
                return storage.authToken;
            }
        }
    }

    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY);

    const challengeResponse = await gotScraping({
        url: `https://core-api.prod.blur.io/auth/challenge`,
        body: JSON.stringify({
            walletAddress: wallet.address
        }),
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
    });
    if (challengeResponse.statusCode != 201) {
        console.error(`Blur challenge error, ${challengeResponse.body}`);
        return "";
    }
    const challengeObject = JSON.parse(challengeResponse.body);
    const signature = await wallet.signMessage(challengeObject.message);
    challengeObject["signature"] = signature;
    const loginResponse = await gotScraping({
        url: `https://core-api.prod.blur.io/auth/login`,
        body: JSON.stringify(challengeObject),
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
    });
    if (loginResponse.statusCode != 201) {
        console.error(`Blur login error, ${loginResponse.body}`);
        return "";
    }
    const loginObject = JSON.parse(loginResponse.body);
    fs.writeFileSync(fileName, JSON.stringify({
        timestamp: Date.now(),
        authToken: loginObject.accessToken
    }));
    return loginObject.accessToken;
}



