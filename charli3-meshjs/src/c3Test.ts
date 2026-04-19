import {blockfrost_api_key} from "@/src/common";
import {c3FetchExample} from "@/src/c3/charli3Oracle";


(async () => {
    try {
        console.log("init test")
        console.log("blockfrost_api_key: ",blockfrost_api_key);
        await c3FetchExample();
    } catch (err) {
        console.error(err);
    }
})();