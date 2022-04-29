import { cb, defaultErrCallback, staticMetadata } from "./utils.js";

/**
 * @type {(input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>}
 */
let myFetch = typeof fetch === "function" ? fetch : (url) => import("node-fetch").then(({default: fetch}) => fetch(url.toString()));

/**
 * discoverServerURLs contacts a web service (likely the Measurement Lab
 * locate service, but not necessarily) and gets URLs with access tokens in
 * them for the client. It can be short-circuted if config.server exists,
 * which is useful for clients served from the webserver of an NDT server.
 *
 * @param {Object} config - An associative array of configuration options.
 * @param {Object} userCallbacks - An associative array of user callbacks.
 *
 * It uses the callback functions `error`, `serverDiscovery`, and
 * `serverChosen`.
 *
 * @name ndt7.discoverServerURLS
 * @public
 */
export async function discoverServerURLs(config, userCallbacks) {
    config.metadata = Object.assign({}, config.metadata);
    config.metadata = Object.assign(config.metadata, staticMetadata);
    const callbacks = {
        error: cb("error", userCallbacks, defaultErrCallback),
        serverDiscovery: cb("serverDiscovery", userCallbacks),
        serverChosen: cb("serverChosen", userCallbacks),
    };
    let protocol = "wss";
    if (config && ("protocol" in config)) {
        protocol = config.protocol;
    }

    const metadata = new URLSearchParams(config.metadata);
    // If a server was specified, use it.
    if (config && ("server" in config)) {
        // Add metadata as querystring parameters.
        const downloadURL = new URL(protocol + "://" + config.server + "/ndt/v7/download");
        const uploadURL = new URL(protocol + "://" + config.server + "/ndt/v7/upload");
        downloadURL.search = metadata.toString();
        uploadURL.search = metadata.toString();
        return {
            "///ndt/v7/download": downloadURL.toString(),
            "///ndt/v7/upload": uploadURL.toString(),
        };
    }

    // If no server was specified then use a loadbalancer. If no loadbalancer
    // is specified, use the locate service from Measurement Lab.
    const lbURL = (config && ("loadbalancer" in config)) ? config.loadbalancer : new URL("https://locate.measurementlab.net/v2/nearest/ndt/ndt7");
    lbURL.search = metadata;
    callbacks.serverDiscovery({ loadbalancer: lbURL });
    const response = await myFetch(lbURL).catch((err) => {
        throw new Error(err);
    });
    const js = await response.json();
    if (!("results" in js)) {
        callbacks.error(`Could not understand response from ${lbURL}: ${js}`);
        return {};
    }

    // TODO: do not discard unused results. If the first server is unavailable
    // the client should quickly try the next server.
    //
    // Choose the first result sent by the load balancer. This ensures that
    // in cases where we have a single pod in a metro, that pod is used to
    // run the measurement. When there are multiple pods in the same metro,
    // they are randomized by the load balancer already.
    const choice = js.results[0];
    callbacks.serverChosen(choice);

    return {
        "///ndt/v7/download": choice.urls[protocol + ":///ndt/v7/download"],
        "///ndt/v7/upload": choice.urls[protocol + ":///ndt/v7/upload"],
    };
}