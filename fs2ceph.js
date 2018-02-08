'use strict';

const MODULE_REQUIRE = 1
    /* built-in */
    , events = require('events')
    , fs = require('fs')
    , path = require('path')
    
    /* NPM */
    , ceph = require('ceph')
    , co = require('co')
    , if2 = require('if2')
    , noda = require('noda')
    , Progress = require('jinang/Progress')
    , cloneObject = require('jinang/cloneObject')
    
    /* in-package */
    , Marker = noda.inRequire('class/Marker')
    , lib = noda.inRequireDir('lib')

    /* in-file */
    ;

/**
 * @param  {object}     source
 * @param  {string}     source.path       path of directory in local file system to be synchronised 
 * @param  {string}     source            alias of source.path
 * 
 * @param  {object}     target            connection configurations of remote CEPH storage
 * @param  {ceph.Connection} target    instance of connection to remote CEPH storage
 * 
 * @param  {object}     options           reserved options
 * 
 * @param  {string[]}  [options.names]             object names to be synchronised
 * @param  {string}    [options.mapper]            object names mapper
 * @param  {number}    [options.maxCreated]        maximum creation allowed (the progress will be terminated)
 * @param  {number}    [options.maxCreating]       maximum cocurrent creating operation allowed
 * @param  {number}    [options.maxErrors]         maximum exceptions allowed (the progress will be terminated)
 * @param  {number}    [options.retry]             maximum retry times on exception for each object
 * 
 * @return EventEmitter
 */
function fs2ceph(source, target, options) {
    // 指代整个同步过程。
    let progress = new Progress();

    // ---------------------------
    // Uniform & validate arguments.

    source = lib.parse_fs_argument(source);
    target = lib.parse_ceph_argument(target);
    
    target.on('error', (err) => {
        progress.emit('error', err);
    });

    options = Object.assign({
        maxCreating : 10,
        maxCreated  : Number.MAX_SAFE_INTEGER,
        maxErrors   : Number.MAX_SAFE_INTEGER,
        retry       : 3,
    }, options);

    if (typeof options.retry != 'number' || isNaN(options.retry)) {
        options.retry = 0;
    }
    
    // ---------------------------
    // Flags.
    
    let 
        // 标记为真时，停止添加新的对象到待创建队列中。
        stopRegister = false, 

        // 标记为真时，停止创建新的对象（已发起创建操作的对象不受影响），即使待创建队列不为空。
        stopCreate = false,

        // 在所有对象均已添加到待创建队列后（注册完毕），标记为真。
        registerFinished = false;
    
    // 收到 QUIT 信号时：
    // * 将“停止注册”标记为 TRUE
    progress.signal(Progress.SIGQUIT, () => {
        stopRegister = true;
    });

    // 收到 ABORT 信号时：
    // * 将“停止注册”标记为 TRUE
    // * 将“停止创建”标记为 TRUE
    progress.signal(Progress.SIGABRT, () => {
        stopRegister = true;
        stopCreate = true;
    });

    // 上次同步点。
    let marker = new Marker(options.marker);

    const STATUS_NAMES = [ 'waiting', 'creating', 'created', 'ignored' ];

    // 队列。
    let queue = {
        // 等待同步的文件列表：[ [cephname, pathname] ]
        waiting: [],

        // 未归档的同步文件状态列表：[ [ cephname, 0 (waiting) | 1 (creating) | 2 (created) | 3 (ignored) ] ]
        unarchived: [],

        // { 对象名 : 重试次数 }
        retry: {},
    };

    // 计数器。
    let counter = {
        // 在同步中的文件数目。
        creating: 0,

        // 已登记（包含不同同步状态）的文件数量。
        registered: 0,

        // 同步失败次数。
        errors: 0,

        // 创建（同步）成功的文件数目。
        created: 0,

        // 忽略（同步失败）的文件数目。
        ignored: 0,
    };

    // 触发 error / end 事件时，附带的统计数据。
    let genReturnMeta = () => Object.assign(
        {}, 
        cloneObject(counter, [ 'errors', 'created', 'ignored' ])
    );

    // ---------------------------
    // Main process.
    
    // 执行创建操作。
    // 在 CEPH 存储中创建对象。
    let create = (cephname, pathname) => {
        counter.creating++;
        let realCephname;
        if (options.mapper) {
            realCephname = options.mapper(cephname);
        }
        else {
            realCephname = cephname;
        }
        target.createObject(realCephname, fs.createReadStream(pathname))
            .then(response => {
                archive(cephname, 2); // 2 means created
            })
            .catch(err => {
                on_create_error(err, cephname, pathname);
            })
            .then(() => {
                counter.creating--;
                next();
            })
            ;
    };

    // 调度队列，尝试执行下一个创建操作。
    let next = () => {
        if (stopCreate) {
            return false;
        }

        if (counter.creating >= options.maxCreating) {
            return false;
        }
        else if (queue.waiting.length == 0) {
            return false;
        }
        else {
            let item = queue.waiting.shift();
            let cephname = item[0], pathname = item[1];

            // 更新同步状态。
            let itemInUnarchived = queue.unarchived.find((q) => q[0] == cephname);
            itemInUnarchived[1] = 1;

            create(cephname, pathname);
            return true;
        }
    };

    let on_create_error = (err, cephname, pathname) => {
        // 判断是否允许重试。
        if (queue.retry[cephname]) {
            // 如果已达最大重试次数，则忽略该对象并标记。
            // 否则仅将重试次数累加。
            if (queue.retry[cephname]++ >= options.retry) {
                delete queue.retry[cephname];
            }
        }
        else if (options.retry) {
            queue.retry[cephname] = 1;
        }

        // 按重试处理。
        if (queue.retry[cephname]) {
            // 重置未归档队列中该对象的状态值。
            queue.unarchived.find((q) => q[0] == cephname)[1] = 0; // 0 := waiting

            // 放入等待队列队首，优先重试创建操作。
            queue.waiting.unshift([cephname, pathname]);
            
            // 触发警告。
            progress.emit('warning', err, genReturnMeta());
        }
        else {
            archive(cephname, 3); // 3 means ignored

            // 触发错误。
            progress.emit('error', err, genReturnMeta());
        }

        // 如果失败次数已达上限，则终止所有事务。
        if (++counter.errors >= options.maxErrors) {
            progress.abort();
            return;
        }
    };

    // 归档已创建对象。
    let archive = (cephname, status) => {
        let i = queue.unarchived.findIndex((q) => q[0] == cephname);

        let statusName = STATUS_NAMES[status];

        // 更新计数。
        // statusName := created | ignored
        counter[statusName]++;

        // 触发事件。
        progress.emit(statusName, { name: cephname });
        
        // 如果在待归档队列中未排在首位，则更新其状态。            
        if (i > 0) {
            queue.unarchived[i][1] = status;
        }
        // 否则，开始归档。
        else {
            let l = queue.unarchived.length;
            while(i+1 < l && queue.unarchived[i+1][1] >= 2) { 
                // >= 2 means created OR ignored
                i++;
            }            
            let markup = queue.unarchived[i][0];
            queue.unarchived.splice(0, i+1);

            // 触发游标前移事件。
            progress.emit('moveon', markup);

            if (registerFinished && queue.unarchived.length == 0) {
                progress.emit('end', genReturnMeta());
            }
        }
        
    };

    // 在队列中登记。
    let register = (cephname, pathname) => {
        // 如果当前登记项数已超过最大可创建对象数，则终止注册，并触发 QUIT 信号。
        if (counter.registered >= options.maxCreated) {
            progress.quit();
            return false;
        }
        else {
            queue.unarchived.push([ cephname, 0 ]);
            queue.waiting.push([ cephname, pathname ]);
            counter.registered++;
            next();
            return true;
        }
    };   

    let on_register_finished = () => {
        registerFinished = true;
        if (counter.registered == 0) {
            progress.emit('end', genReturnMeta());
        }
    };

    // 深度优先，遍历目录。
    let started = false;
    let run = (dirname, parentCephNamePieces) => { 
        return co(function*() {
            // Why not fs.readdirSync() ?
            // To avoid IO blocking.
            let fsnames = yield new Promise((resolve, reject) => {
                fs.readdir(dirname, (err, names) => {
                    names = names.sort((p, f) => p > f);
                    resolve(names);
                });
            });

            for (let i = 0; i < fsnames.length; i++) {
                // 如果收到异常信号，则终止遍历。
                if (stopRegister) return;

                let fsname = fsnames[i];
                let cephnamePieces = parentCephNamePieces.concat(fsname);
                let cephname = cephnamePieces.join('/');
                
                if (marker.equal(cephname)) {
                    started = true;
                    continue;
                }

                // 如果尚未开始同步，则根据是否超越同步点，判断是否需要深入检查。
                if (started || !marker.cover(cephname)) {
                    let realpath = path.join(dirname, fsname);

                    // Why not fs.statSync() ?
                    // To avoid IO blocking.
                    let stats = yield new Promise((resolve, reject) => {
                        fs.stat(realpath, (err, stats) => {
                            resolve(stats);
                        });
                    });
                        
                    // 遇目录则递归遍历。
                    if (stats.isDirectory()) {
                        yield run(realpath, cephnamePieces);
                    }

                    // 遇文件则直接同步（上载）。
                    else {
                        register(cephname, realpath);
                    }
                }
            }
            if (parentCephNamePieces.length == 0) on_register_finished();
        }).catch(err => {
            console.log(err);
        });
    };
    
    process.nextTick(() => {
        if (options.names) {
            options.names.forEach(name => {
                let realpath = path.resolve(source.path, name);
                register(name, realpath);
            });
            on_register_finished();
        }
        else {
            run(source.path, []);
        }
    });

    return progress;
}

module.exports = fs2ceph;