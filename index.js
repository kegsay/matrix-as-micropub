"use strict";

module.exports.serviceName = "micropub";
module.exports.configure = function(config) {

};

module.exports.register = function(controller, serviceConfig) {
    controller.addRegexPattern("users", "@micropub_.*", true);
    controller.on("type:m.room.message", function(event) {
        console.log("RECV: %s", event.content.body);
    });
};