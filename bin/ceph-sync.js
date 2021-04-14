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
    , manon = require('manon')
    , noda = require('noda')
    , JsonFile = require('jinang/JsonFile')
    , Directory = require('jinang/Directory')
    , cloneObject = require('jinang/cloneObject')
    , sort = require('jinang/sort')
    , uniq = require('jinang/uniq')
    
    /* in-package */
    , lib = noda.inRequireDir('lib')

    /* in-file */
    , NL = '\n'
    ;

// ---------------------------
// Command line options validation.

const OPTIONS = commandos.parse({
    groups: [
        [ '--help -h [0:=*help] REQUIRED' ],
        [ 
            '--source -s [0] NOT NULL REQUIRED',
            '--source-container --source-bucket NOT NULL', 
            '--prefix NOT NULL',
            '--target -t [1] NOT NULL REQUIRED',
            '--target-container --target-bucket NOT NULL', 
            '--container --bucket NOT NULL',
            '--mapper NOT NULLABLE',
            '--filter NOT NULLABLE',
            '--dual-meta-filter NOT NULLABLE',
            '--retry',
            '--start-over NOT ASSIGNABLE',
            '--force NOT ASSIGNABLE',
            '--fill NOT ASSIGNABLE',
            '--if-none-match NOT ASSIGNABLE',
            '--concurrency --co NOT NULL DEFAULT(10)',
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
    commandos.man(noda.inRead('help.txt', 'utf8'));
    return;
}

if (OPTIONS.retry === true) {
    OPTIONS.retry = 3;
}
else {
    OPTIONS.retry = parseInt(OPTIONS.retry);
}

OPTIONS.source = path.resolve(OPTIONS.source);
OPTIONS.target = path.resolve(OPTIONS.target);

let action = null;

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

let syncOptions = { 
    retry       : OPTIONS.retry,
    maxCreating : OPTIONS.concurrency,
    prefix      : OPTIONS.prefix,
    ifNoneMatch : OPTIONS['if-none-match'],
    // , ... 注意：下面还有！ 
};

// 为了实现可续传，我们需要一串包含描述该任务内容的实质性参数（影响该任务的结果，而非过程）。
// 这些参数将构成任务的 taskId 。
let taskId = {};

let source = OPTIONS.source;
let target = OPTIONS.target;    
CREATE_CEPH_CONNECTIONS: {
    let createConn = (pathname, container, name) => {
        let connJson;
        try {
            connJson = JSON.parse(fs.readFileSync(pathname));
        }
        catch (ex) {
            console.error(`not a valid JSON file: ${pathname}`);
            process.exit(1);
        }

        /**
         * @upate 2021-04-08
         * Change/set default container/bucket of connection(s).
         */
        if (container) {
            if (Array.isArray(connJson)) {
                connJson.forEach(data => { data.container = container });
            }
            else {
                connJson.container = container;
            }
        }

        let conn = lib.parse_ceph_argument(connJson);
        if (!conn.get('container')) {
            console.error(`container info missed in CEPH connection file: ${pathname}`);
            process.exit(1);
        }
        conn.on('error', ex => {
            if (ex.action == 'AUTH') {
                console.log(`${name} connection failed, ${ex.message}`);
            }
        });
        return conn;        
    };

    if (action == 'ceph2fs' || action == 'ceph2ceph') {
        source = createConn(source, OPTIONS['source-container'] || OPTIONS.container, 'source');
    }
    if (action == 'fs2ceph' || action == 'ceph2ceph') {
        target = createConn(target, OPTIONS['target-container'] || OPTIONS.container, 'target');
    }

    taskId.source = source;
    taskId.target = target;
}

LOAD_OUTER_MODULES: {
    [ 'mapper', 'filter', 'dual-meta-filter' ].forEach(name => {
        if (!OPTIONS[name]) return;

        let camelCaseName = name.replace(/-./g, s => s.slice(1).toUpperCase());
        let pathname = path.resolve(OPTIONS[name]);
        
        let fn;
        try {
            fn = require(pathname);
        } catch(ex) {
            console.error(`failed to load ${name} module: ${pathname}`);
            console.error('--------');
            console.error(ex);
            process.exit(1);
        }
    
        if (typeof fn != 'function') {
            console.error(`${name} should be a function: ${pathname}`);
            process.exit(1);
        }

        syncOptions[camelCaseName] = fn;
        taskId[name] = fn.toString();
    });     
}

// Transform the task id object to an MD5 string.
taskId = crypto.createHash('md5').update(JSON.stringify(taskId)).digest('hex');

// Get task data from user profile.
let commandHomepath = path.join(os.homedir(), '.ceph-sync');
let taskLogHomepath = path.join(commandHomepath, taskId);
let taskJF = new JsonFile(path.join(taskLogHomepath, 'task.json'));
Object.assign(taskJF.json, { 
    source: source.toString(), 
    target: target.toString(),
});

let taskDir = new Directory(taskLogHomepath);
let logpath = {
    success : 'success.log', 
    error   : 'error.log',
    ignore  : 'ignore.log',
    skipped : 'skipped.log',
    'no-utf8-filename' : 'no-utf8-filename.log',
};

// require('../ceph2ceph')
// require('../ceph2fs')
// require('../fs2ceph')
let runner = noda.inRequire(`${action}`);

if (!OPTIONS['start-over'] && !OPTIONS.fill) {
    syncOptions.marker = taskJF.json.marker;
}

// 补遗。
if (OPTIONS.fill) {
    // 从日志及日志备份中读取所有被忽略（同步失败）的对象名，并合为一处。
    let lines = '';
    [ 'ignore.log', 'ignore.bak' ].forEach(name => {
        if (taskDir.exists(name)) {
            lines += taskDir.read(name, 'utf8');
        }        
    });
    lines = uniq(sort(lines.split(NL))).filter(name => name !== '');
    
    // 备份。
    // 若命令执行中断，下次补遗操作仍将尝试全部记录。
    taskDir.write('ignore.bak', lines.join(NL));

    // 删除日志。
    taskDir.rmfr('ignore.log');

    syncOptions.names = lines;
}

let progress = runner(source, target, syncOptions);

console.log(`logs in ${taskLogHomepath}`);
console.log('-- START --');

let log = cloneObject(logpath, (name, pathname) => [ name, taskDir.open(pathname, 'a') ] );

progress.on('created', (obj) => {
    console.log('[ CREATED ]', obj.name);
    fs.writeSync(log.success, NL + obj.name);
});

progress.on('moveon', (marker) => {
    if (OPTIONS.fill) return;

    console.log('[ MOVEON  ]', marker);
    taskJF.json.marker = marker;
    taskJF.save();
});

progress.on('ignored', (obj) => {
    console.log('[ IGNORED ]', obj.name);
    fs.writeSync(log.ignore, NL + obj.name);
});

progress.on('skipped', (obj) => {
    console.log('[ SKIPPED ]', obj.name);
    fs.writeSync(log.skipped, NL + obj.name);
});

progress.on('no-utf8-filename', (obj) => {
    let posname = obj.dirname + ':' + obj.filenameBuffer.toString('hex');
    console.log('[ NO-UTF8-FILENAME ]', posname);
    fs.writeSync(log['no-utf8-filename'], NL + posname);
});

progress.on('warning', (err) => {
    console.log('[ WARNING ]', err.toString());
    fs.writeSync(log.error, NL + err.message);
});

progress.on('error', (err) => {
    console.log(err);
    console.log('[ ERROR   ]', err.toString());
    fs.writeSync(log.error, NL + err.message);
});

progress.on('end', (meta) => {
    console.log('-- END --');
    console.log(`total ${meta.created} created and ${meta.ignored} ignored`);
    console.log(`more logs in ${taskLogHomepath}`);

    // 删除日志备份。
    if (OPTIONS.fill) {
        taskDir.rmfr('ignore.bak');
    }
});
