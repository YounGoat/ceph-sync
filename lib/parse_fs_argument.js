'use strict';

const MODULE_REQUIRE = 1
	/* built-in */
	, fs = require('fs')
	, path = require('path')
	
	/* NPM */
	
	/* in-package */
	;

module.exports = (options) => {
	if (typeof options == 'string') {
        options = {
            path: options
        };
	}
	else {
		options = Object.assign({}, options);
	}

	options.path = path.resolve(process.cwd(), options.path);

	return options;
};