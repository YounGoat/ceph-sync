#!/usr/bin/env node

'use strict';

const MODULE_REQUIRE = 1
    /* built-in */
    , crypto = require('crypto')
    , fs = require('fs')
    , os = require('os')
    , path = require('path')
    
    /* NPM */
    , if2 = require('if2')
    , commandos = require('commandos')
    , noda = require('noda')
    , JsonFile = require('jinang/JsonFile')
    , Directory = require('jinang/Directory')
    
    /* in-package */
    , cephSync = require('../index')
    ;


// ---------------------------
// Command line options validation.

const OPTIONS = commandos.parse({
    groups: [
        [ '--help -h [0:=*help] REQUIRED' ],
        [ 
            '--source -s [0] REQUIRED', 
            '--target -t [1] REQUIRED',
            '--retry',
            '--resync-ignored',
        ]
    ],
    explicit: true,
    catcher: (err) => {
        console.log(err.message);
        console.log('Run "ceph-sync --help" to see detailed help info.');
        process.exit(1);
    }
});

if (OPTIONS.help) {
    console.log(noda.inRead('help.txt', 'utf8'));
    process.exit(0);
}

if (OPTIONS.retry === true) {
    OPTIONS.retry = 3;
}
else {
    OPTIONS.retry = parseInt(OPTIONS.retry);
}

OPTIONS.source = path.resolve(OPTIONS.source);
OPTIONS.target = path.resolve(OPTIONS.target);

// ---------------------------
// Main Process.

let commandHomepath = path.join(os.homedir(), '.ceph-sync');
let tasksJF = new JsonFile(path.join(commandHomepath, 'tasks.json'));

let cephConnJson = JSON.parse(fs.readFileSync(OPTIONS.target));
let source = OPTIONS.source;

let taskIdText = `${JSON.stringify(cephConnJson)}:${OPTIONS.source}`;
let taskId = crypto.createHash('md5').update(taskIdText).digest('hex');

if (!tasksJF.json[taskId]) {
    tasksJF.json[taskId] = {
        'source': OPTIONS.source,
        'target': OPTIONS.target,
    };
}
let task = tasksJF.json[taskId];
let progress = cephSync.fs2ceph(source, cephConnJson, { 
    marker : task.marker,
    retry  : OPTIONS.retry,
    mapper : name => 'ares/' + name,
});

let dir = new Directory(commandHomepath);
let log = {
    success : dir.open(`logs/${taskId}/success.log`, 'a'), 
    error   : dir.open(`logs/${taskId}/error.log`, 'a'),
    ignore  : dir.open(`logs/${taskId}/ignore.log`, 'a')
};

progress.on('created', (obj) => {
    console.log('CREATED', obj.name);
    fs.writeSync(log.success, `\n${obj.name}`);
});

progress.on('moveon', (marker) => {
    task.marker = marker;
    tasksJF.save();
    console.log('MOVEON', marker);
});

progress.on('ignored', (obj) => {
    console.log('IGNORED', obj.name);
    fs.writeSync(log.ignore, `\n${obj.name}`);
});

progress.on('warning', (err) => {
    console.log('WARNING', err.toString());
    fs.writeSync(log.error, `\n${err.message}`);
});

progress.on('error', (err) => {
    console.log('ERROR', err.toString());
    fs.writeSync(log.error, `\n${err.message}`);
});

progress.on('end', () => {
    console.log('-- END --');
});
