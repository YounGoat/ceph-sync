#!/usr/bin/env node

'use strict';

const MODULE_REQUIRE = 1
    /* built-in */
    , crypto = require('crypto')
    , fs = require('fs')
    , os = require('os')
    , path = require('path')
    
    /* NPM */
    , ceph = require('ceph')
    , if2 = require('if2')
    , commandos = require('commandos')
    , noda = require('noda')
    , JsonFile = require('jinang/JsonFile')
    , Directory = require('jinang/Directory')
    , cloneObject = require('jinang/cloneObject')
    
    /* in-package */

    /* in-file */
    ;

// ---------------------------
// Command line options validation.

const OPTIONS = commandos.parse({
    groups: [
        [ '--help -h [0:=*help] REQUIRED' ],
        [ 
            '--source -s [0] REQUIRED',
            '--source-container --source-bucket NOT NULL', 
            '--target -t [1] REQUIRED',
            '--target-container --target-bucket NOT NULL', 
            '--container --bucket NOT NULL',
            '--mapper NOT NULLABLE',
            '--retry',
            '--start-over',
            '--force',
        ]
    ],
    explicit: true,
    catcher: (err) => {
        console.error(err.message);
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

if (OPTIONS.mapper) OPTIONS.mapper = path.resolve(OPTIONS.mapper);
OPTIONS.source = path.resolve(OPTIONS.source);
OPTIONS.target = path.resolve(OPTIONS.target);

let action = null;

// No `try {} catch() {}` needed because the existence has been verified before.
if (1) {
    let 
        source_exists  = fs.existsSync(OPTIONS.source),
        target_exists  = fs.existsSync(OPTIONS.target),
        source_is_file = source_exists && fs.statSync(OPTIONS.source).isFile(),
        target_is_file = target_exists && fs.statSync(OPTIONS.target).isFile(),
        source_is_dir  = source_exists && fs.statSync(OPTIONS.source).isDirectory(),
        target_is_dir  = target_exists && fs.statSync(OPTIONS.target).isDirectory();


    if (source_is_dir && target_is_file) {
        action = 'fs2ceph';
    }
    else if (source_is_file && (!target_exists || target_is_dir)) {
        action = 'ceph2fs';
        if (!OPTIONS.force && target_is_dir && fs.readdirSync(OPTIONS.target).length > 0) {
            console.log(`target directory already exists, use --force to overwrite`);
            process.exit(1);
        }
    }
    else if (source_is_file && target_is_file) {
        action = 'ceph2ceph';
    }
    else {
        console.error('source and target should be directory or a CEPH connection file. And at least one of them should be a CEPH connection file.');
        process.exit(1);
    }
}

// ---------------------------
// Main Process.

// Create CEPH connections.
let createConn = (pathname, container) => {
    try {
        let connJson = JSON.parse(fs.readFileSync(pathname));
        if (container) connJson.container = container;

        let conn = ceph.createConnection(connJson);
        if (!conn.get('container')) {
            console.error(`container info missed in CEPH connection file: ${pathname}`);
            process.exit(1);
        }
        return conn;
    }
    catch (ex) {
        console.error(`not a valid JSON file: ${pathname}`);
        process.exit(1);
    }
};

let source = OPTIONS.source, target = OPTIONS.target;
if (action == 'ceph2fs' || action == 'ceph2ceph') {
    source = createConn(source, OPTIONS['source-container'] || OPTIONS.container);
}
if (action == 'fs2ceph' || action == 'ceph2ceph') {
    target = createConn(target, OPTIONS['target-container'] || OPTIONS.container);
}

// Load mapper module.
let mapper = null;
if (OPTIONS.mapper) {
    let pathname = OPTIONS.mapper;
    try {
        mapper = require(pathname);
    } catch(ex) {
        console.error(`failed to load mapper module: ${pathname}`);
        console.error('--------');
        console.error(ex);
        process.exit(1);
    }

    if (typeof mapper != 'function') {
        console.error(`mapper should be a function: ${pathname}`);
        process.exit(1);
    }
}

// Get task data from user profile.
let commandHomepath = path.join(os.homedir(), '.ceph-sync');
let tasksJF = new JsonFile(path.join(commandHomepath, 'tasks.json'));

let taskIdText = `${source}:${target}:${mapper}`;
let taskId = crypto.createHash('md5').update(taskIdText).digest('hex');

if (!tasksJF.json[taskId]) {
    tasksJF.json[taskId] = { 
        source: OPTIONS.source, 
        target: OPTIONS.target,
    };
}
let task = tasksJF.json[taskId];

// require('../ceph2ceph')
// require('../ceph2fs')
// require('../fs2ceph')
let runner = noda.inRequire(`${action}`);

let progress = runner(source, target, { 
    marker : OPTIONS['start-over'] ? null : task.marker,
    retry  : OPTIONS.retry,
    mapper,
});

let dir = new Directory(commandHomepath);
let logpath = {
    success : `logs/${taskId}/success.log`, 
    error   : `logs/${taskId}/error.log`,
    ignore  : `logs/${taskId}/ignore.log`,
};
let log = cloneObject(logpath, (name, pathname) => [ name, dir.open(pathname, 'a') ] );

progress.on('created', (obj) => {
    console.log('[ CREATED ]', obj.name);
    fs.writeSync(log.success, `\n${obj.name}`);
});

progress.on('moveon', (marker) => {
    task.marker = marker;
    tasksJF.save();
    console.log('[ MOVEON  ]', marker);
});

progress.on('ignored', (obj) => {
    console.log('[ IGNORED ]', obj.name);
    fs.writeSync(log.ignore, `\n${obj.name}`);
});

progress.on('warning', (err) => {
    console.log('[ WARNING ]', err.toString());
    fs.writeSync(log.error, `\n${err.message}`);
});

progress.on('error', (err) => {
    console.log('[ ERROR ]', err.toString());
    fs.writeSync(log.error, `\n${err.message}`);
});

progress.on('end', (meta) => {
    console.log('-- END --');
    console.log(`total ${meta.created} created and ${meta.ignored} ignored`);
    console.log(`more logs in ${path.join(commandHomepath, 'logs', taskId)}`);
});
