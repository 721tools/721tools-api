export const decode = (input) => {
    const key = "XTtnJ44LDXvZ1MSjdyK4pPT8kg5meJtHF44RdRBGrsaxS6MtG19ekKBxiXgp";
    const bytes = Buffer.from(input, "base64").toString("utf-8");
    let result = "";
    for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result;
}