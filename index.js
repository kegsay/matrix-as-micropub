"use strict";
var db = require("./lib/db");
var lib = require("./lib/micropub");

var micropubUser, oauthInfo;

module.exports.serviceName = "micropub";
module.exports.configure = function(config) {
    if (!config.dbname) {
        throw new Error("Required: 'dbname'");
    }
    oauthInfo = config.oauth;
    db.init(config.dbname);
};

module.exports.register = function(controller, serviceConfig) {
    micropubUser = (
        "@" + module.exports.serviceName + ":" + serviceConfig.homeserver.domain
    );
    var asurl = serviceConfig.appservice.url;
    lib.init(
        serviceConfig.homeserver.url,
        serviceConfig.appservice.token,
        micropubUser,
        serviceConfig.appservice.url,
        {
            path: oauthInfo.path,
            port: oauthInfo.port,
            uri: (asurl.indexOf(":") === -1 ? 
                asurl + oauthInfo.path :
                asurl.replace(/:[0-9]+/, ":"+oauthInfo.port) + oauthInfo.path
            )
        }
    );
    controller.addRegexPattern("users", "@micropub_.*", true);
    controller.on("type:m.room.member", function(event) {
        if (event.state_key === micropubUser && event.content.membership === "invite") {
            lib.handleInvite(event.user_id, event.room_id);
        }
    });
    controller.on("type:m.room.message", function(event) {
        if (event.user_id === micropubUser) {
            return;
        }
        lib.handleMessage(event.room_id, event.user_id, event.content.body);
    });
};