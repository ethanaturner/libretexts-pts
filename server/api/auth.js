//
// LibreTexts Conductor
// auth.js

'use strict';
const User = require('../models/user.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const conductorErrors = require('../conductor-errors.js');
const { debugError } = require('../debug.js');
const { isEmptyString } = require('../util/helpers.js');

const axios = require('axios');

const initSSO = (req, res) => {
    return res.redirect(308,
        'http://sso.libretexts.org/cas/oauth2.0/authorize?client_id=' + process.env.OAUTH_CLIENT_ID);
};

const oauthCallback = (req, res, next) => {
    console.log(req);
    console.log("CALLBACK");
    res.sendStatus(200);
};


/**
 * Handles user login by finding a user account,
 * verifying the provided password, and issuing
 * authorization cookies.
 */
const login = (req, res, _next) => {
    var isNewMember = false;
    var payload = {};
    const formattedEmail = String(req.body.email).toLowerCase();
    User.findOne({ email: formattedEmail }).then((user) => {
        if (user) {
            return Promise.all([bcrypt.compare(req.body.password, user.hash), user]);
        } else {
            throw(new Error("Couldn't find an account with that email."));
        }
    }).then(([isMatch, user]) => {
        payload.uuid = user.uuid;
        if (isMatch) {
            if (Array.isArray(user.roles)) {
                var foundRole = user.roles.find((item) => {
                    if (item.org === process.env.ORG_ID) {
                        return item;
                    }
                    return null;
                });
                if (foundRole === undefined) {
                    isNewMember = true;
                }
            }
            if (isNewMember) {
                return User.updateOne({ uuid: user.uuid }, {
                    $push: {
                        roles: {
                            org: process.env.ORG_ID,
                            role: 'member'
                        }
                    }
                });
            } else {
                return {};
            }
        } else {
            throw(new Error('password'));
        }
    }).then((updateRes) => {
        jwt.sign(payload, process.env.SECRETKEY, {
            expiresIn: 86400
        },(err, token) => {
            if (!err && token !== null) {
                const splitToken = token.split('.');
                var accessCookie = 'conductor_access=' + splitToken[0] + '.' + splitToken[1] + '; Path=/;';
                var sigCookie = 'conductor_signed=' + splitToken[2] + '; Path=/; HttpOnly;';
                if (process.env.NODE_ENV === 'production') {
                    const domains = String(process.env.PRODUCTIONURLS).split(',');
                    accessCookie += " Domain=" + domains[0] + ';';
                    sigCookie += " Domain=" + domains[0] + '; Secure;';
                }
                const cookiesToSet = [accessCookie, sigCookie];
                res.setHeader('Set-Cookie', cookiesToSet);
                return res.send({
                    err: false,
                    isNewMember: isNewMember
                });
            } else {
                throw(err);
            }
        });
    }).catch((err) => {
        if (err.message === 'password') {
            return res.send({
                err: true,
                errMsg: conductorErrors.err12
            });
        } else {
            debugError(err);
            return res.send({
                err: true,
                errMsg: conductorErrors.err6
            });
        }
    });
};

/**
 * Handles user registration by creating a User
 * model with the information in the request
 * body and hashing the provided password.
 */
const register = (req, res) => {
    const formattedEmail = String(req.body.email).toLowerCase();
    var newUser = {
        uuid: uuidv4(),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: formattedEmail,
        avatar: '',
        hash: '',
        salt: '',
        roles: []
    };
    bcrypt.genSalt(10).then((salt) => {
        newUser.salt = salt;
        return bcrypt.hash(req.body.password, salt);
    }).then((hash) => {
        newUser.hash = hash;
        var readyUser = new User(newUser);
        return readyUser.save();
    }).then((doc) => {
        if (doc) {
            return res.send({
                err: false,
                msg: "Succesfully registered user."
            });
        } else {
            throw(new Error('notcreated'));
        }
    }).catch((err) => {
        debugError(err);
        return res.send({
            err: true,
            errMsg: conductorErrors.err6
        });
    });
};

/**
 * Verifies the JWT provided in a request's Authorization
 * header.
 */
const verifyRequest = (req, res, next) => {
    var token = req.headers.authorization;
    try {
        const decoded = jwt.verify(token, process.env.SECRETKEY);
        req.user = {
            decoded: decoded
        };
        req.decoded = decoded; // TODO: REMOVE AND UPDATE OTHER LOGIC
        return next();
    } catch (err) {
        var response = {
            err: true,
            errMsg: "Invalid token. Try signing out and in again."
        };
        if (err.name === 'TokenExpiredError') {
            response.tokenExpired = true;
        }
        return res.status(401).send(response);
    }
};

/**
 * Pulls the user record from the database and adds
 * its attributes (roles) to the
 * request object.
 * Method should only be called AFTER the 'verifyRequest'
 * method in a routing chain.
 */
const getUserAttributes = (req, res, next) => {
    if (req.user.decoded !== undefined) {
        User.findOne({
            uuid: req.user.decoded.uuid
        }).then((user) => {
            if (user) {
                if (user.roles !== undefined) {
                    req.user.roles = user.roles;
                }
                return next();
            } else {
                throw(new Error('nouser'));
            }
        }).catch((err) => {
            if (err.message === 'nouser') {
                return res.send(401).send({
                    err: true,
                    errMsg: conductorErrors.err7
                });
            } else {
                debugError(err);
                return res.status(500).send({
                    err: true,
                    errMsg: conductorErrors.err6
                });
            }
        });
    } else {
        return res.status(400).send({
            err: true,
            errMsg: conductorErrors.err5
        });
    }
};

/**
 * Checks that the user has the role
 * specified in the @role parameter for
 * this organization.
 * NOTE: This method should NOT be used as
 *  middleware.
 */
const checkHasRole = (user, org, role) => {
    if ((user.roles !== undefined) && (Array.isArray(user.roles))) {
        var foundRole = user.roles.find((element) => {
            if (element.org && element.role) {
                if ((element.org === org) && (element.role === role)) {
                    return element;
                } else if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                    // OVERRIDE: SuperAdmins always have permission
                    return element;
                }
            }
            return null;
        });
        if (foundRole !== undefined) {
            return true;
        } else {
            return false;
        }
    } else {
        debugError(conductorErrors.err9);
        return false;
    }
};

/**
 * Checks that the user has the role
 * specified in the @role parameter.
 * Method should only be called AFTER the 'getUserAttributes'
 * method in a routing chain.
 */
const checkHasRoleMiddleware = (org, role) => {
    return (req, res, next) => {
        if ((req.user.roles !== undefined) && (Array.isArray(req.user.roles))) {
            var foundRole = req.user.roles.find((element) => {
                if (element.org && element.role) {
                    if ((element.org === org) && (element.role === role)) {
                        return element;
                    } else if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                        // OVERRIDE: SuperAdmins always have permission
                        return element;
                    }
                }
                return null;
            });
            if (foundRole !== undefined) {
                next();
            } else {
                return res.status(401).send({
                    err: true,
                    errMsg: conductorErrors.err8
                });
            }
        } else {
            debugError(conductorErrors.err9);
            return res.status(400).send({
                err: true,
                errMsg: conductorErrors.err9
            });
        }
    }
};


const passwordValidator = (password) => {
    if (typeof(password) === 'string') {
        if (password.length > 8) { // password should be 8 characters or longer
            if (/\d/.test(password)) { // password should contain at least one number
                return true;
            }
        }
    }
    return false;
};

/**
 * Middleware(s) to verify requests contain
 * necessary fields.
 */
const validate = (method) => {
    switch (method) {
        case 'login':
            return [
                body('email', conductorErrors.err1).exists().isEmail(),
                body('password', conductorErrors.err1).exists().isLength({ min: 1 }),
            ]
        case 'register':
            return [
                body('email', conductorErrors.err1).exists().isEmail(),
                body('password', conductorErrors.err1).exists().isString().custom(passwordValidator),
                body('firstName', conductorErrors.err1).exists().isLength({ min: 2, max: 100 }),
                body('lastName', conductorErrors.err1).exists().isLength({ min: 1, max: 100})
            ]
    }
}

module.exports = {
    login,
    register,
    verifyRequest,
    getUserAttributes,
    checkHasRole,
    checkHasRoleMiddleware,
    validate,
    oauthCallback,
    initSSO
};
