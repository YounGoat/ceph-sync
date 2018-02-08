#	ceph-sync
__Tool to sync contents between local file system and remote object storage.__

[![total downloads of ceph-sync](https://img.shields.io/npm/dt/ceph-sync.svg)](https://www.npmjs.com/package/ceph-sync)
[![ceph-sync's License](https://img.shields.io/npm/l/ceph-sync.svg)](https://www.npmjs.com/package/ceph-sync)
[![latest version of ceph-sync](https://img.shields.io/npm/v/ceph-sync.svg)](https://www.npmjs.com/package/ceph-sync)

This tool can achieve synchronizations as:
*	directory A → container B
*	container B → directory A
*	container B → container C

Here, *directory* is located in local file system and made up of files and sub directories, while *container* (also called *bucket* according to AWS S3) is vessel in remote CEPH storage where objects saved.

##	Table of contents

*	[Get Started](#get-started)
*	[Connection Config](#connection-config)
*	[API](#api)

##	Links

*	[CHANGE LOG](./CHANGELOG.md)
*	[Homepage](https://github.com/YounGoat/ceph-sync)

##	Get Started

In CLI:
```bash
# Command "ceph-sync", "cehsync" and "ossync" will be generated.
npm install -g ceph-sync

# Show help info.
ceph-sync -h

# Run sync task.
ceph-sync --source /path/of/container --target /path/of/conn.json
```

As API:

```javascript
const fs2ceph = require('ceph-sync/fs2ceph');

const progress = fs2ceph(
	/* source */ '/path/of/container',
	/* target */ connConfig );

progress.on('error', (err) => {
	// ...
});

progress.on('end', (meta) => {
	// Sychronization successfully finished.
});
```

##	Connection Config

The connection configuration is a JSON object required by the dependent package [ceph](https://www.npmjs.com/package/ceph). To describe an accessible (readable and writable) CEPH container, following properties are required:

*	endPoint
*	subuser
*	key
*	container

Here is a dummy example: 
```javascript
{
	"endPoint"   : "http://storage.example.com/",
	"subuser"    : "userName:subUserName",
	"key"        : "380289ba59473a368c593c1f1de6efb0380289ba5", 
	"container"  : "containerName"
}
```

For CLI usage, CEPH connection config should be stored in a JSON file.

##	CLI

When installed globally, __ceph-sync__ will create a homonymous global command. Run `ceph-sync -h` in terminal to print the man page.

__ceph-sync__ will occupy a hidden directory named `.ceph-sync` in home directory of current user.

##	API

__ceph-sync__ offers three functions to achieve different tasks:

*	jinang/Progress __ceph2ceph__(object *sourceConn*, object *targetConn*, object *options*)
*	jinang/Progress __ceph2fs__(object *sourceConn*, string *targetDir*, object *options*)
*	jinang/Progress __fs2ceph__(string *sourceDir*, object *targetConn*, object *options*)

1.	Here *2* is a homophone of *to*.   
1.	*sourceConn* and *targetConn* may be an object containing [CEPH storage connection configuration](#connection-config), or an instance of [swift Connection](https://www.npmjs.com/package/ceph#osapiswift).  
1.	The functions accept similar *options* argument, see section [Parameter `options`](#parameter-options) for details.
1.	The functions are all asynchronous and will return an instance of [jinang/Progress](https://www.npmjs.com/package/jinang#progress). Via the returned value, we may learn about and control the sync progress. See section [Get Into Sync Progress](#get-into-sync-progress) for details.

Each function may be required solely:

```javascript
const cephSync  = require('ceph-sync');

const ceph2ceph = require('ceph-sync/ceph2ceph');
const ceph2fs   = require('ceph-sync/ceph2fs');
const fs2ceph   = require('ceph-sync/fs2ceph');

// E.g., next two functions are equivalent.
cephSync.ceph2ceph
ceph2ceph
```

###	Parameter `options`

*	string[] __options.names__  
	Object names to be synchronised.

*	Function __options.mapper__
	Object name mapper.

* 	number __options.maxCreated__  
	Maximum creation allowed (then the progress will be terminated).

*	number __options.maxCreating__  
	Maximum cocurrent creating operation allowed.

*	number __options.maxErrors__  
	Maximum exceptions allowed (then the progress will be terminated).

*	number __options.retry__  
	Maximum retry times on exception for each object or object list.

###	Get Into Sync Progress

Via the returned instance of `jinang/Progress`, we may learn about what happened and then control the sync progress.

*	__progress.on__(string *eventName*, Function *listener*)  
	Following events are supported:
	*	Event: __created__  
		Arguments: object *meta*
	*	Event: __moveon__  
		Arguments: string *mark*
	*	Event: __ignored__  
		Arguments: object *meta*
	*	Event: __warning__  
		Arguments: Error *error*
	*	Event: __error__  
		Arguments: Error *error*
	*	Event: __end__  
		Arugments: object *meta*

*	__progress.abort__()  
	Terminate the progress as soon as possible.

*	__progress.quit__()  
	Quit the progress gracefully.