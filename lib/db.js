"use strict";
var q = require("q");
var sqlite3 = require("sqlite3");

var db;

module.exports.init = function(dbname) {
    db = new sqlite3.Database(dbname);
    db.parallelize();
    db.run("CREATE TABLE IF NOT EXISTS rooms(" +
        "room_id TEXT NOT NULL PRIMARY KEY," +
        "user_id TEXT NOT NULL," +
        "is_admin BOOL NOT NULL" +
    ")");
    db.run("CREATE TABLE IF NOT EXISTS users(" +
        "user_id TEXT NOT NULL PRIMARY KEY," +
        "domain TEXT NOT NULL," +
        "oauth_token TEXT" +
    ")");
    db.run("CREATE TABLE IF NOT EXISTS sessions(" +
        "state TEXT NOT NULL PRIMARY KEY," +
        "me TEXT NOT NULL," +
        "redirect_uri TEXT NOT NULL," +
        "oauth_url TEXT NOT NULL,"+
        "user_id TEXT NOT NULL"+
    ")");
};

module.exports.storeSession = function(oauthUrl, userId, session) {
    var d = q.defer();
    db.run("INSERT INTO sessions(state, me, oauth_url, redirect_uri, user_id) " +
        "VALUES(?,?,?,?,?)",
        session.state, session.me, oauthUrl, session.redirect_uri, userId,
        promiseify(d)
    );
    return d.promise;
};

module.exports.setAdminRoom = function(roomId, userId, isAdmin) {
    var d = q.defer();
    db.run("INSERT INTO rooms(room_id, user_id, is_admin) VALUES(?,?,?)",
        roomId, userId, Boolean(isAdmin), promiseify(d));
    return d.promise;
}

var promiseify = function(defer) {
    return function(err) {
        if (err) {
            defer.reject(err);
            return;
        }
        defer.resolve();
    };
};