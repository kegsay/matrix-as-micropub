"use strict";
var db = require("./lib/db");

module.exports.serviceName = "micropub";
module.exports.configure = function(config) {
    if (!config.dbname) {
        throw new Error("Required: 'dbname'");
    }
    db.init(config.dbname);
};

module.exports.register = function(controller, serviceConfig) {
    controller.addRegexPattern("users", "@micropub_.*", true);
    controller.on("type:m.room.message", function(event) {
        console.log("RECV: %s", event.content.body);
    });
};