export async function getWalletDappAddress(wallet: any): Promise<string> {
    if (!wallet) return "";
    if (typeof wallet.init === "function") {
        try {
            await wallet.init();
        } catch {
            console.info("Wallet init skipped or not needed.");
        }
    }

    const usedAddresses: string[] = await wallet.getUsedAddresses();
    if (usedAddresses.length > 0) {
        return usedAddresses[0];
    }

    const changeAddress = await wallet.getChangeAddress();
    if (changeAddress) {
        console.log("Picked wallet address from change address:", changeAddress);
        return changeAddress;
    }

    //TODO Avoid this?
    const unusedAddresses: string[] = await wallet.getUnusedAddresses();
    if (unusedAddresses.length > 0) {
        return unusedAddresses[0];
    }

    return "";
}
