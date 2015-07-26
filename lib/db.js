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

module.exports.storeUser = function(userId, domain, token) {
    var d = q.defer();
    db.serialize(function() {
        db.run("DELETE FROM users WHERE user_id=?", userId);

        db.run("INSERT INTO users(user_id, domain, oauth_token) " +
            "VALUES(?,?,?)",
            userId, domain, token, promiseify(d)
        );
    });
    
    return d.promise;
};

module.exports.getUser = function(userId) {
    var d = q.defer();
    db.get("SELECT * FROM users WHERE user_id=?", userId, promiseify(d));
    return d.promise;
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

module.exports.getSession = function(state) {
    var d = q.defer();
    var resolved = false;
    db.get("SELECT * FROM sessions WHERE state=?", state, function(err, data) {
        if (err || !data) {
            d.reject("No data");
            return;
        }
        d.resolve(data);
    });
    return d.promise;
};

module.exports.deleteSession = function(state) {
    var d = q.defer();
    db.run("DELETE FROM sessions WHERE state=?", state, promiseify(d));
    return d.promise;
};

module.exports.setAdminRoom = function(roomId, userId, isAdmin) {
    var d = q.defer();
    db.run("INSERT INTO rooms(room_id, user_id, is_admin) VALUES(?,?,?)",
        roomId, userId, Boolean(isAdmin), promiseify(d));
    return d.promise;
}

module.exports.getAdminRoom = function(userId) {
    var d = q.defer();
    db.get("SELECT * FROM rooms WHERE user_id=? AND is_admin=? LIMIT 1",
        userId, true, promiseify(d));
    return d.promise;
}

var promiseify = function(defer) {
    return function(err, data) {
        if (err) {
            defer.reject(err);
            return;
        }
        defer.resolve(data);
    };
};