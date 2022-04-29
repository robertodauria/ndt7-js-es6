import * as utils from "./utils";
import WebSocket from "ws";

export async function upload(config, userCallbacks, urlPromise) {
    const callbacks = {
        error: utils.cb("error", userCallbacks, utils.defaultErrCallback),
        start: utils.cb("uploadStart", userCallbacks),
        measurement: utils.cb("uploadMeasurement", userCallbacks),
        complete: utils.cb("uploadComplete", userCallbacks),
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

    const url = urls["///ndt/v7/upload"];
    return new Promise((resolve, reject) => {
        // Make sure the promise is resolved after the timeout.
        setTimeout(() => {
            resolve(1);
        }, utils.defaultTimeout);
        const sock = new WebSocket(url, utils.subProtocol);

        console.log("upload");
        let closed = false;

        sock.onopen = function () {
            const initialMessageSize = 8192; /* (1<<13) = 8kBytes */
            const data = new Uint8Array(initialMessageSize);
            const start = utils.now(); // ms since epoch
            const duration = 10000; // ms
            const end = start + duration; // ms since epoch

            callbacks.start({
                StartTime: start,
                ExpectedEndTime: end,
            });

            // Start the upload loop.
            uploader(data, start, end, start, 0);
        };

        // onmessage calls the measurement callback for every counterflow
        // message received from the server during the upload measurement.
        sock.onmessage = function (ev) {
            if (typeof ev.data !== "undefined") {
                callbacks.measurement({
                    ServerData: JSON.parse(ev.data.toString())
                });
            }
        };

        // onclose calls the complete callback when the upload is complete.
        sock.onclose = function () {
            if (!closed) {
                closed = true;
            }
            callbacks.complete({});
            resolve(1);
        };

        sock.onerror = function (ev) {
            callbacks.error("Error: " + ev);
            reject(ev);
        };

        /**
         * uploader is the main loop that uploads data in the web browser. It must
         * carefully balance a bunch of factors:
         *   1) message size determines measurement granularity on the client side,
         *   2) the JS event loop can only fire off so many times per second, and
         *   3) websocket buffer tracking seems inconsistent between browsers.
         *
         * Because of (1), we need to have small messages on slow connections, or
         * else this will not accurately measure slow connections. Because of (2), if
         * we use small messages on fast connections, then we will not fill the link.
         * Because of (3), we can't depend on the websocket buffer to "fill up" in a
         * reasonable amount of time.
         *
         * So on fast connections we need a big message size (one the message has
         * been handed off to the browser, it runs on the browser's fast compiled
         * internals) and on slow connections we need a small message. Because this
         * is used as a speed test, we don't know before the test which strategy we
         * will be using, because we don't know the speed before we test it.
         * Therefore, we use a strategy where we grow the message exponentially over
         * time. In an effort to be kind to the memory allocator, we always double
         * the message size instead of growing it by e.g. 1.3x.
         *
         * @param {*} data
         * @param {*} start
         * @param {*} end
         * @param {*} previous
         * @param {*} total
         */
        function uploader(data, start, end, previous, total) {
            const t = utils.now();
            if (t >= end) {
                sock.close();
                // send one last measurement, resolve the promise and return.
                postClientMeasurement(total, sock.bufferedAmount, start);
                resolve(1);
                return;
            }

            const maxMessageSize = 8388608; /* = (1<<23) = 8MB */
            const clientMeasurementInterval = 250; // ms

            // Message size is doubled after the first 16 messages, and subsequently
            // every 8, up to maxMessageSize.
            const nextSizeIncrement =
                (data.length >= maxMessageSize) ? Infinity : 16 * data.length;
            if ((total - sock.bufferedAmount) >= nextSizeIncrement) {
                data = new Uint8Array(data.length * 2);
            }

            // We keep 7 messages in the send buffer, so there is always some more
            // data to send. The maximum buffer size is 8 * 8MB - 1 byte ~= 64M.
            const desiredBuffer = 7 * data.length;
            if (sock.bufferedAmount < desiredBuffer) {
                sock.send(data);
                total += data.length;
            }

            if (t >= previous + clientMeasurementInterval) {
                postClientMeasurement(total, sock.bufferedAmount, start);
                previous = t;
            }

            // Loop the uploader function in a way that respects the JS event handler.
            setTimeout(() => uploader(data, start, end, previous, total), 0);
        }

        /** Report measurement back to the caller.
         *
         * Note: client-side measurement are not guaranteed to be accurate, because
         * the browser (or the websocket library, in case this runs with nodejs)
         * might report bufferedAmount incorrectly.
         *
         * @param {*} total
         * @param {*} bufferedAmount
         * @param {*} start
         */
        function postClientMeasurement(total, bufferedAmount, start) {
            // bytes sent - bytes buffered = bytes actually sent
            const numBytes = total - bufferedAmount;
            // ms / 1000 = seconds
            const elapsedTime = (utils.now() - start) / 1000;
            // bytes * bits/byte * megabits/bit * 1/seconds = Mbps
            const meanMbps = numBytes * 8 / 1000000 / elapsedTime;
            callbacks.measurement({
                ClientData: {
                    ElapsedTime: elapsedTime,
                    NumBytes: numBytes,
                    MeanClientMbps: meanMbps,
                },
            });
        }
    });
}