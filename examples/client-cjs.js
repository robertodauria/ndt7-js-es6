/* eslint-env node */
// This example shows how to use the ndt7-js library as a CommonJS module in NodeJS.
const ndt7 = require("../dist/ndt7.js");

ndt7.run({
    userAcceptedDataPolicy: true,
}, {
    serverDiscovery: function () {
        console.log("Server discovery started");
    },
    serverChosen: function (server) {
        console.log("Server chosen: ", server);
    },
    downloadStart: function () {
        console.log("Download started");
    },
    downloadComplete: function (data) {
        console.log("Download complete");
        console.log("Client measurement: ", data.LastClientMeasurement);
        console.log("Server measurement: ", data.LastServerMeasurement);
    },
    downloadMeasurement: function (measurement) {
        if (typeof measurement.ClientData !== "undefined") {
            console.log("Client-side measurement: ", measurement.ClientData);
        }
        if (typeof measurement.ServerData !== "undefined") {
            console.log("Server-side measurement: ", measurement.ServerData);
        }
    },
    uploadStart: function () {
        console.log("Upload started");
    },
    uploadComplete: function (data) {
        console.log("Upload complete");
        console.log("Client measurement: ", data.LastClientMeasurement);
        console.log("Server measurement: ", data.LastServerMeasurement);
    },
    uploadMeasurement: function (measurement) {
        if (typeof measurement.ClientData !== "undefined") {
            console.log("Client-side measurement: ", measurement.ClientData);
        }
        if (typeof measurement.ServerData !== "undefined") {
            console.log("Server-side measurement: ", measurement.ServerData);
        }
    },
});
