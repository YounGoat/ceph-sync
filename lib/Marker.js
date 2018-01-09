'use strict';

const MODULE_REQUIRE = 1
    /* built-in */
    
    /* NPM */
    
    /* in-package */

    /* in-file */
    ;    

// Argument "mark" SHOULD be the name of an object stored in ceph, namely the pathname of corresponding file.
function Marker(mark) {
    if (!mark) mark = '';
    this.mark = mark;
}

Marker.prototype.equal = function(cephName) {
    return this.mark == cephName;  
};

Marker.prototype.cover = function(cephName) {
    return Marker.cover(this.mark, cephName);
};

Marker.prototype.update = function(cephName) {
    this.mark = cephName;  
};

Marker.prototype.toString = function() {
    return this.mark;  
};

Marker.cover = function(a, b) {
    let covered = false;
    
    let aPieces = a.split('/');
    let bPieces = b.split('/');
    let l = Math.min(aPieces.length, bPieces.length);
    for (let i = 0; i < l; i++) {
        covered = (bPieces[i] < aPieces[i]);
        if (covered) break;
    }

    return covered;
};

module.exports = Marker;