"use strict";
var db = require("./db");
var sdk = require("matrix-js-sdk");
var validUrl = require("valid-url");
var cheerio = require("cheerio");
var request = require("request");
var crypto = require("crypto");
var q = require("q");

var client, clientId, redirectUri;

module.exports.init = function(hsUrl, asToken, userId, asUrl) {
    clientId = hsUrl;
    redirectUri = asUrl + "/oauth/redirect";
    client = sdk.createClient({
        baseUrl: hsUrl,
        accessToken: asToken,
        userId: userId
    });
};

module.exports.handleInvite = function(inviter, roomId) {
    console.log("Handling invite from %s", inviter);
    // join ALL THE ROOMS!
    client.joinRoom(roomId).done(function() {
        console.log("Joined room %s", roomId);
        db.setAdminRoom(roomId, inviter, true).done(function(){
            console.log("Stored admin room %s", roomId);
        }, function(err) {
            console.error("Failed to store admin room %s", roomId);
        });
    }, function(err) {
        console.error("Failed to join room %s", roomId);
    });
};

module.exports.handleMessage = function(roomId, userId, body) {
    console.log("Handling message from %s", userId);
    body = body || "";
    if (body.indexOf("!indieauth ") === 0) {
        var url = body.substring("!indieauth ".length);
        if (validUrl.isUri(url)) {
            doIndieAuthRedirect(roomId, userId, url).done(function(s) {
                client.sendTextMessage(roomId, s);
            }, function(err) {
                console.log("Indie auth redirect failed: %s", err);
                client.sendTextMessage(roomId, err);
            })
        }
        else {
            console.log("Bad url: %s", url);
            client.sendTextMessage(
                roomId,
                "That doesn't look like a url. Usage: '!indieauth http://domain.com'"
            );
        }
    }
};

var doIndieAuthRedirect = function(roomId, userId, url) {
    console.log("Doing indie auth redirect for %s", url);
    var d = q.defer();
    // The web application checks the user's website for a link with a rel-value
    // of "authorization_endpoint".
    request(url, function(err, res, body) {
        if (err) {
            console.log(err);
            d.reject("Failed to hit "+url+" : " + err.message);
            return;
        }
        else if (res.statusCode >= 300) {
            d.reject("%s returned status code %s", url, res.statusCode);
            return;
        }
        var u = cheerio.load(body);
        var oauthUrl;
        var links = u("link").each(function(i) {
            if (u(this).attr("rel") === "authorization_endpoint") {
                oauthUrl = u(this).attr("href");
                return false;
            }
        });
        if (oauthUrl) {
            var session = {
                me: url,
                client_id: clientId,
                redirect_uri: redirectUri,
                state: crypto.randomBytes(24).toString("hex"),
                response_type: "code",
                scope: "post"
            };
            db.storeSession(oauthUrl, userId, session).done(function() {
                // craft the url
                var qs = "?";
                for (var key in session) {
                    if (!session.hasOwnProperty(key)) { continue; }
                    qs += "&" + encodeURIComponent(key) + "=" +
                            encodeURIComponent(session[key]);
                }
                d.resolve("Please log in: " + oauthUrl + qs);
            }, function(err) {
                d.reject("Failed to store session: " + err.message);
            });
        }
        else {
            d.reject("Failed to find a link with rel='authorization_endpoint'.");
        }
    });
    return d.promise;
};