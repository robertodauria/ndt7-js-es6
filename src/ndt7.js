import { download } from "./download.js";
import { discoverServerURLs } from "./locate.js";
import { upload } from "./upload.js";

export async function run(config, userCallbacks) {
    // Starts the asynchronous process of server discovery, allowing other
    // stuff to proceed in the background.
    const urlPromise = discoverServerURLs(config, userCallbacks);
    await download(
        config, userCallbacks, urlPromise)
        .catch((err) => {
            console.log("Error during download: " + err);
        });
    await upload(
        config, userCallbacks, urlPromise)
        .catch((err) => {
            console.log("Error during upload: " + err);
        });
}