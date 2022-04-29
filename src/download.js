import { cb, defaultErrCallback, policyAccepted, protocol } from "./utils";
import WebSocket from "ws";

export async function download(config, userCallbacks, urlPromise) {
    const callbacks = {
        error: cb("error", userCallbacks, defaultErrCallback),
        start: cb("downloadStart", userCallbacks),
        measurement: cb("downloadMeasurement", userCallbacks),
        complete: cb("downloadComplete", userCallbacks),
    };

    if (!policyAccepted(config)) {
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

    let now;
    if (typeof performance !== "undefined" &&
        typeof performance.now === "function") {
        now = () => performance.now();
    } else {
        now = () => Date.now();
    }

    // Wrap the upload logic into a Promise that isn't fulfilled until either
    // the upload has completed successful, the timeout has elapsed or an error
    // has occurred.
    return new Promise((resolve, reject) => {
        // Make sure the promise is resolved after the timeout.
        setTimeout(resolve, 12000);
        const sock = new WebSocket(url, protocol);

        let start = now();
        let previous = start;
        let total = 0;

        sock.onopen = function () {
            start = now();
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
            const t = now();
            const every = 250; // ms
            if (t - previous > every) {
                callbacks.measurement({
                    ClientData: {
                        ElapsedTime: (t - start) / 1000, // seconds
                        NumBytes: total,
                        // MeanClientMbps is calculated via the logic:
                        //  (bytes) * (bits / byte) * (megabits / bit) = Megabits
                        //  (Megabits) * (1/milliseconds) * (milliseconds / second) = Mbps
                        // Collect the conversion constants, we find it is 8*1000/1000000
                        // When we simplify we get: 8*1000/1000000 = .008
                        MeanClientMbps: (total / (t - start)) * 0.008,
                    }
                });

                previous = t;
            }

            // Pass along every server-side measurement.
            if (typeof ev.data === "string") {
                callbacks.measurement({
                    ServerData: JSON.parse(ev.data),
                });
            }
        };

        sock.onclose = function () {
            callbacks.complete();
            resolve(1);
        };

        sock.onerror = function (ev) {
            callbacks.error("Error: " + ev);
            reject(ev);
        };

    });
}