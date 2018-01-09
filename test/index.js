'use strict';

const MODULE_REQUIRE = 1
    /* built-in */
    , assert = require('assert')

    /* NPM */
    , noda = require('noda')
    
    /* in-package */
    , Marker = noda.inRequire('lib/Marker')
    ;

describe('Marker', () => {
    
    let marker = new Marker('/a/b/c');
    
    it('/a/b/c cover /a/a', () => {
        assert(marker.cover('/a/a'));
    });

    it('/a/b/c cover /a/a/anything', () => {
        assert(marker.cover('/a/a/anything'));
    });

    it('/a/b/c cover /a/b/bravo', () => {
        assert(marker.cover('/a/b/bravo'));
    });
    
    it('/a/b/c NOT cover /a/b', () => {
        assert(!marker.cover('/a/b'));
    });

    it('/a/b/c NOT cover /a/b/dog', () => {
        assert(!marker.cover('/a/b/dog'));
    });
});