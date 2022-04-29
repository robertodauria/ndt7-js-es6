import ndt7 from "../dist/ndt7.js";

ndt7.run({
    userAcceptedDataPolicy: true,
}, {
    downloadStart: function () {
        console.log("Download started");
    },
    downloadComplete: function () {
        console.log("Download complete");
    },
    downloadMeasurement: function (measurement) {
        if (typeof measurement.ClientData !== "undefined") {
            console.log("Client-side measurement: " + JSON.stringify(measurement.ClientData));
        }
        if (typeof measurement.ServerData !== "undefined") {
            console.log("Server-side measurement: " + JSON.stringify(measurement.ServerData));
        }
    },
    uploadStart: function () {
        console.log("Upload started");
    },
    uploadComplete: function () {
        console.log("Upload complete");
    },
    uploadMeasurement: function (measurement) {
        if (typeof measurement.ClientData !== "undefined") {
            console.log("Client-side measurement: " + JSON.stringify(measurement.ClientData));
        }
        if (typeof measurement.ServerData !== "undefined") {
            console.log("Server-side measurement: " + JSON.stringify(measurement.ServerData));
        }
    },
});