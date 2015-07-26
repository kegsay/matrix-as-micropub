"use strict";
var db = require("./db");
var sdk = require("matrix-js-sdk");
var validUrl = require("valid-url");
var cheerio = require("cheerio");
var request = require("request");
var crypto = require("crypto");
var q = require("q");

var client, clientId, redirectUri;

module.exports.init = function(hsUrl, asToken, userId, asUrl, redirect) {
    clientId = hsUrl;
    redirectUri = redirect.uri;
    client = sdk.createClient({
        baseUrl: hsUrl,
        accessToken: asToken,
        userId: userId
    });
    listenForRedirects(redirect.path, redirect.port);
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
    else {
        // do we know this guy?
        var user;
        db.getUser(userId).then(function(usr) {
            user = usr;
            if (!user) {
                throw new Error("Not an authed user.");
            }
            return slurpLink(user.domain, "micropub");
        }).done(function(link) {
            // map message to a micropub entry
            console.log("Mapping message '%s' to a micropub entry...", body);
            // craft url and submit
            request.post(link, {form: {
                access_token: user.oauth_token,
                h: "entry",
                content: body
            }}, function(err, res, body) {
                if (!err && res.statusCode < 300) {
                    client.sendTextMessage(roomId, "Success!");
                }
                else {
                    var errmsg = err || ("Code: " + res.statusCode);
                    client.sendTextMessage(roomId, "Failed: " + errmsg);
                }
            });
        }, function(e) {
            console.error(e);
        });
        


    }
};

var doIndieAuthRedirect = function(roomId, userId, url) {
    console.log("Doing indie auth redirect for %s", url);
    var d = q.defer();
    // The web application checks the user's website for a link with a rel-value
    // of "authorization_endpoint".
    slurpLink(url, "authorization_endpoint").done(function(oauthUrl) {
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
    }, function(err) {
        d.reject(err);
    });
    return d.promise;
};

var doIndieAuthVerify = function(state, code, me) {
    // check session exists
    var d = q.defer();
    console.log("Verifying token (state=%s me=%s)", state, me);
    db.getSession(state).done(function(session) {
        request.post(session.oauth_url, {form: {
            code: code,
            client_id: session.client_id,
            state: state,
            redirect_uri: session.redirect_uri
        }}, function(err, res, body) {
            if (err) {
                d.reject(err.message);
                return;
            }
            if (res.statusCode >= 300) {
                d.reject(
                    "Verifying code returned status code " + res.statusCode
                );
                return;
            }
            var lines = body.split("\r\n");
            var me;
            lines.forEach(function(line) {
                var segs = line.split("=");
                if (segs[0] === "me") {
                    me = segs[1];
                }
            });
            if (me !== session.me) {
                d.reject("Authed as "+me+" instead of "+session.me);
                return;
            }
            db.storeUser(session.user_id, session.me, code).done(function() {
                d.resolve("Authorised as " + session.me);
                console.log("Authorised %s as %s", session.user_id, session.me);
                db.getAdminRoom(session.user_id).done(function(room) {
                    client.sendTextMessage(
                        room.room_id, "Authorised as " + session.me
                    );
                }, function(e) {
                    console.error(e);
                });
            }, function(e) {
                d.reject(e);
            });
        });
        db.deleteSession(state);
    }, function(e) {
        console.log("Failed to find session.");
        d.reject(e);
    });

    return d.promise;
};

var slurpLink = function(url, rel) {
    var d = q.defer();
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
        var linkHref;
        var links = u("link").each(function(i) {
            if (u(this).attr("rel") === rel) {
                linkHref = u(this).attr("href");
                return false;
            }
        });
        if (linkHref) {
            d.resolve(linkHref);
        }
        else {
            d.reject("No link found for rel="+rel);
        }
    });
    return d.promise;
};

var listenForRedirects = function(path, port) {
    var express = require("express");
    var bodyParser = require('body-parser');
    var app = express();
    app.use(bodyParser.json());
    app.get(path, function(req, res) {
        var state = req.query.state;
        var code = req.query.code;
        var me = req.query.me;
        doIndieAuthVerify(state, code, me).done(function(s) {
            res.send(s);
        }, function(err) {
            res.send(err);
        });
    });
    var server = app.listen(port, function() {
        var port = server.address().port;
        console.log("OAuth2 redirect listening on port %s", port);
    });
};