import * as utils from "./utils";
import { discoverServerURLs } from "./locate";
import WebSocket from "ws";

/**
 * download runs an ndt7 download test using the passed-in configuration
 * object and the provided callbacks. If a server is not specified in the
 * config, it will be discovered automatically via the Locate API.
 * 
 * @param {Object} config - An associative array of configuration strings
 * @param {Object} userCallbacks
 * 
 * @returns {Promise<number>} - A promise that will resolve to the test's
 * exit code.
 * 
 */
export async function download(config, userCallbacks) {
    const urlPromise = discoverServerURLs(config, userCallbacks);
    return downloadFromURL(config, userCallbacks, urlPromise);
}

/**
 * downloadFromURL runs an ndt7 download test using the passed-in configuration
 * object, the provided callbacks and a promise returning a URL to the server.
 *
 * @param {Object} config - An associative array of configuration strings
 * @param {Object} userCallbacks
 * @param {Promise<Object>} urlPromise - A promise that will resolve to a
 * result from the Locate API.
 */
export async function downloadFromURL(config, userCallbacks, urlPromise) {
    const callbacks = {
        error: utils.cb("error", userCallbacks, utils.defaultErrCallback),
        start: utils.cb("downloadStart", userCallbacks),
        measurement: utils.cb("downloadMeasurement", userCallbacks),
        complete: utils.cb("downloadComplete", userCallbacks),
    };

    if (!utils.policyAccepted(config)) {
        callbacks.error("The M-Lab data policy is applicable and the user " +
            "has not explicitly accepted that data policy.");
        return;
    }

    // We can't start the worker until we know the right server, so we wait
    // here to find that out.
    const urls = await urlPromise.catch((err) => {
        callbacks.error("Error: " + err);
    });

    const url = urls["///ndt/v7/download"];

    // Wrap the download logic into a Promise that isn't fulfilled until either
    // the upload has completed successful, the timeout has elapsed or an error
    // has occurred.
    return new Promise((resolve, reject) => {
        const sock = new WebSocket(url, utils.subProtocol);

        // After the expected measurement duration, close the socket, compute
        // one last client measurement, send the results back and resolve the
        // Promise.
        let timeout = setTimeout(() => {
            doneReceiving = true;
            sock.close();
            let t = utils.now();
            callbacks.complete({
                LastClientMeasurement: {
                    ElapsedTime: (t - start) / 1000, // seconds
                    NumBytes: total,
                    MeanClientMbps: (total / (t - start)) * 0.008,
                },
                LastServerMeasurement: lastServerMeasurement,
            });
            resolve(0);
        }, 10000);

        let start = utils.now();
        let previous = start;
        let total = 0;

        let lastClientMeasurement = {};
        let lastServerMeasurement = {};

        let doneReceiving = false;

        sock.onopen = function () {
            start = utils.now();
            previous = start;
            total = 0;
            callbacks.start({
                ClientStartTime: start,
            });
        };

        sock.onmessage = function (ev) {
            total +=
                (typeof ev.data.size !== "undefined") ? ev.data.size : ev.data.length;
            // Perform a client-side measurement 4 times per second.
            const t = utils.now();
            const every = 250; // ms
            if (t - previous > every) {
                lastClientMeasurement = {
                    ElapsedTime: (t - start) / 1000, // seconds
                    NumBytes: total,
                    // MeanClientMbps is calculated via the logic:
                    //  (bytes) * (bits / byte) * (megabits / bit) = Megabits
                    //  (Megabits) * (1/milliseconds) * (milliseconds / second) = Mbps
                    // Collect the conversion constants, we find it is 8*1000/1000000
                    // When we simplify we get: 8*1000/1000000 = .008
                    MeanClientMbps: (total / (t - start)) * 0.008,
                };
                callbacks.measurement({
                    ClientData: lastClientMeasurement
                });

                previous = t;
            }

            // Pass along every server-side measurement.
            if (typeof ev.data === "string") {
                lastServerMeasurement = JSON.parse(ev.data);
                callbacks.measurement({
                    ServerData: lastServerMeasurement,
                });
            }
        };

        // onclose calls the complete callback and resolves the promise. If the
        // socket is closed early by the server, measurements collected so far
        // are still valid.
        sock.onclose = function () {
            // This makes sure the complete callback is only called once.
            if (!doneReceiving) {
                callbacks.complete({
                    LastServerMeasurement: lastServerMeasurement,
                    lastClientMeasurement: lastClientMeasurement,
                });
                clearTimeout(timeout);
            }
            resolve(1);
        };

        sock.onerror = function (ev) {
            callbacks.error("Error: " + ev);
            reject(ev);
        };

    });
}