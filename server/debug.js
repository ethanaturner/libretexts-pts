import debugUtil from 'debug';
import util from 'util';

export const debug = debugUtil('conductor');

export const debugServer = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[SERVER]: %s', msg);
    } else {
        debug('[SERVER]: %s', msg.toString());
    }
};

export const debugDB = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[DB]: %s', msg);
    } else {
        debug('[DB]: %s', msg.toString());
    }
};

export const debugObject = (obj) => {
    console.log(util.inspect(obj, { showHidden: false, depth: null }));
};

export const debugError = (err) => {
    debug('[ORGID - %s]: %s', process.env.ORG_ID, err.toString());
};

export const debugCommonsSync = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[COMMONS SYNC]: %s', msg);
    } else {
        debug('[COMMONS SYNC]: %s', msg.toString());
    }
};

export const debugADAPTSync = (msg) => {
    if (typeof(msg) === 'string') {
        debug('[COMMONS SYNC]: %s', msg);
    } else {
        debug('[COMMONS SYNC]: %s', msg.toString());
    }
};
