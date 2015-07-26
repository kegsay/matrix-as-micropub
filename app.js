"use strict";

var appservice = require("matrix-appservice");
var micropub = require("matrix-appservice-micropub");
var yaml = require("js-yaml");
var fs = require("fs");
var nopt = require("nopt");
var opts = nopt({
    "generate-registration": Boolean
});

micropub.configure({
    dbname: "data.db"
});

appservice.registerService({
    service: micropub,
    homeserver: {
        url: "http://localhost:8008",
        token: "hs_token",
        domain: "localhost"
    },
    appservice: {
        url: "http://localhost:8778",
        token: "as_token"
    },
    http: {
        port: 8778
    }
});

if (opts["generate-registration"]) {
    appservice.getRegistration().done(function(reg) {
        fs.writeFile(
            "micropub-registration.yaml",
            yaml.safeDump(reg),
            function(e) {
                if (e) {
                    console.error("Failed to write registration: %s", e);
                    process.exit(1);
                }
                else {
                    process.exit(0);
                }
        });
    });
}
else {
    appservice.runForever();
}