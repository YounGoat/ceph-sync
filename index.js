'use strict';

const MODULE_REQUIRE = 1
	/* built-in */
	
	/* NPM */
	, noda = require('noda')
	
	/* in-package */
	, ceph2fs = noda.inRequire('ceph2fs')
	, ceph2ceph = noda.inRequire('ceph2ceph')
	, fs2ceph = noda.inRequire('fs2ceph')
	;

module.exports = {
	fs2ceph,
	ceph2fs,
	ceph2ceph,
};
