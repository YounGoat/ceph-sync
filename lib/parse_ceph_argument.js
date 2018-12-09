'use strict';

const MODULE_REQUIRE = 1
	/* built-in */
	
	/* NPM */
	, ceph = require('ceph')
	, cephDual = require('ceph-dual')
	
	/* in-package */
	;

module.exports = (option) => {

	let conn = null;
    if (ceph.isConnection(option) || cephDual.isConnection(option)) {
        conn = option;
    }
    else {
        conn = ceph.createConnection(option);
	}
	
	return conn;
};