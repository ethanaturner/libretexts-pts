'use strict';
const User = require('../models/user.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = (req, res, next) => {
    var response = {};
    const emailReq = req.body.email;
    const passwordReq = req.body.password;
    if (emailReq === "" || passwordReq === "") {
        response.err = true;
        response.errmsg = "Empty fields.";
        return res.send(response);
    }
    const formattedEmail = String(emailReq).toLowerCase();
    User.findOne({ email: formattedEmail }).then((user) => {
        if (user) {
            return Promise.all([bcrypt.compare(passwordReq, user.hash), user]);
        } else {
            throw("Couldn't find an account with that email.");
        }
    }).then(([isMatch, user]) => {
        console.log(user);
        const payload = {
            uuid: user.uuid
        };
        if (isMatch) {
            jwt.sign(payload, process.env.SECRETKEY, {
                expiresIn: 86400
            },(err, token) => {
                if (!err && token !== null) {
                    response.err = false;
                    response.token = token;
                } else {
                    throw(err);
                }
                return res.send(response);
            });
        } else {
            throw("Incorrect password.");
        }
    }).catch((err) => {
        response.err = true;
        response.errMsg = err;
        return res.send(response);
    });
};

const verifyRequest = (req, res, next) => {
    var token = req.headers.authorization;
    var rawToken = String(token).replace("Bearer ", "");
    try {
        const decoded = jwt.verify(rawToken, process.env.SECRETKEY);
        req.decoded = decoded;
        return next();
    } catch (err) {
        var response = {
            err: true,
            errMsg: "Invalid token. Try signing out and in again."
        };
        if (err.name === 'TokenExpiredError') {
            response.tokenIsExp = true;
        }
        return res.status(401).send(response);
    }
};

module.exports = {
    login,
    verifyRequest
};
