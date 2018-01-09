#	ceph-sync
__Tool to sync contents between local file system and remote object storage.__

[![total downloads of ceph-sync](https://img.shields.io/npm/dt/ceph-sync.svg)](https://www.npmjs.com/package/ceph-sync)
[![ceph-sync's License](https://img.shields.io/npm/l/ceph-sync.svg)](https://www.npmjs.com/package/ceph-sync)
[![latest version of ceph-sync](https://img.shields.io/npm/v/ceph-sync.svg)](https://www.npmjs.com/package/ceph-sync)

##	Table of contents

*	[Get Started](#get-started)
*	[API](#api)

##	Links

*	[CHANGE LOG](./CHANGELOG.md)
*	[Homepage](https://github.com/YounGoat/ceph-sync)

##	Get Started

In Node.js:
```javascript
const cephSync = require('ceph-sync');

const progress = cephSync.fs2ceph(
	/* source */ '/path/of/container',
	/* target */ connConfig );

progress.on('error', (err) => {
	// ...
});

progress.on('end', (meta) => {
	// Sychronization successfully finished.
});
```

In CLI:
```bash
# Command "ceph-sync", "cehsync" and "ossync" will be generated.
npm install -g ceph-sync

# Show help info.
ceph-sync -h

# Run sync task.
ceph-sync --source /path/of/container --target /path/of/conn.json
```

The connection configuration is a JSON object/file, see [ceph README](https://www.npmjs.com/package/ceph#openstack-swift-style) for details.

