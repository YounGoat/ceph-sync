'use strict';

const MODULE_REQUIRE = 1
	/* built-in */
	
	/* NPM */
	, ceph = require('ceph')
	, cephDual = require('ceph-dual')
	
	/* in-package */
	;

module.exports = (option) => {

	/**
	 * Is this function a duplicate of `createConn()` in "bin/ceph-sync.js"?
	 * 此函数的功能是否与 bin/ceph-sync.js 中的 createConn() 重复呢？
	 */

	let conn = null;
    if (ceph.isConnection(option) || cephDual.isConnection(option)) {
        conn = option;
    }

	/**
	 * @update 2021-04-08
	 */
    else {
        // conn = ceph.createConnection(option);
		conn = ( Array.isArray(option) ? cephDual : ceph ).createConnection(option);
	}
	
	return conn;
};