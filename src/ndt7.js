import { download, downloadFromURL } from "./download.js";
import { discoverServerURLs } from "./locate.js";
import { upload, uploadFromURL } from "./upload.js";

export async function run(config, userCallbacks) {
    // Starts the asynchronous process of server discovery, allowing other
    // stuff to proceed in the background.
    const urlPromise = discoverServerURLs(config, userCallbacks);
    await downloadFromURL(
        config, userCallbacks, urlPromise)
        .catch((err) => {
            console.log("Error during download: " + err);
        });
    await uploadFromURL(
        config, userCallbacks, urlPromise)
        .catch((err) => {
            console.log("Error during upload: " + err);
        });
}

export { download, upload };
