import fs from "fs";
import path from "path";
import { ethers } from 'ethers';

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
    console.log(JSON.stringify(args));
    const blurProxyIface = new ethers.utils.Interface(blurProxyAbi);
    return blurProxyIface.encodeFunctionData("buyAssetsForEth", args);
}
