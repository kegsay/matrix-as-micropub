"use strict";

var appservice = require("matrix-appservice");
var micropub = require("matrix-appservice-micropub");
var yaml = require("js-yaml");
var fs = require("fs");
var nopt = require("nopt");
var opts = nopt({
    "generate-registration": Boolean,
    "config": String
}, {
    "-c": "config"
});

// load the config file
var configFile;
try {
    configFile = yaml.safeLoad(fs.readFileSync(opts.config, 'utf8'));
} 
catch (e) {
    console.error("Failed to read config file '%s' : %s", opts.config, e);
    process.exit(1);
    return;
}

micropub.configure({
    dbname: "data.db",
    oauth: configFile.appservice.oauth
});

appservice.registerService({
    service: micropub,
    homeserver: {
        url: configFile.homeserver.url,
        token: configFile.homeserver.token,
        domain: configFile.homeserver.domain
    },
    appservice: {
        url: configFile.appservice.url,
        token: configFile.appservice.token
    },
    http: {
        port: configFile.appservice.port
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