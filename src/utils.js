export const staticMetadata = {
    "client_library_name": "ndt7-js",
    "client_library_version": "0.1.0",
};

export const subProtocol = "net.measurementlab.ndt.v7";
export const defaultTimeout = 12000;

/**
 * Checks whether the user has accepted the data policy, or the policy is
 * not applicable.
 *
 * @param {Object} config - The configuration object.
 * @returns {boolean} - Whether the policy is considered accepted.
 */
export function policyAccepted(config) {
    return config.userAcceptedDataPolicy === true ||
        config.mlabDataPolicyInapplicable === true;
}

/**
 * Default error callback. It just throws the error.
 * @param {string} err - The error message.
 */
export function defaultErrCallback(err) {
    throw new Error(err);
}

/**
 * Returns the user-defined function with a given name, if it exist. If it
 * does not exist, but a default function is provided, it returns it. If
 * everything else fails, it returns an empty callback.
 * 
 * This allows the caller to only need to specify callback functions for the
 * events they care about.
 * 
 * @param {string} name - The callback's name.
 * @param {Object} callbacks - An associative array of user callbacks.
 * @param {(err: string) => void} [defaultFn] - The default callback
 *   when the user-defined callback with a given name is not defined.
 * 
 * @returns {(Object?) => void} - The callback function.
 * @public
 */
export function cb(name, callbacks, defaultFn) {
    if (typeof (callbacks) !== "undefined" && name in callbacks) {
        return callbacks[name];
    } else if (typeof defaultFn !== "undefined") {
        return defaultFn;
    } else {
        // If no default function is provided, use the empty function.
        return function () { };
    }
}

/**
 * @type {() => number}
 */
export let now;
if (typeof performance !== "undefined" &&
    typeof performance.now === "function") {
    now = () => performance.now();
} else {
    now = () => Date.now();
}