#   ceph-sync Change Log

Notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning 2.0.0](http://semver.org/).

##	[0.10.1] - 2021-04-14

*	Fix bug where leading data blocks may be missed when creating object from stream.  
	修正错误：当从流中读取数据并写入多个存储时，可能存在部分数据块丢失的情况。

##	[0.10.0] - Apr 21st, 2020

*	New option `--if-none-match` and `options.ifNoneMatch` added.

##  [0.9.0] - Jan 5th, 2020

*   Upgrade dependency `ceph` to 1.0.0, and `ceph-dual` to 0.1.0.

##  [0.8.2] - May 19th, 2019

*   Upgrade dependency `jinang` to enable `.toPromise()` and `.final()` method of returned instance of `jinang/Progress`.

##	[0.8.1] - Jan 23rd, 2019

*	Set default value to option `--concurrency`.

##  [0.8.0] - Dec 10th, 2018

*   New option `--prefix` available when the source is CEPH storage.

##  [0.7.0] - Dec 9th, 2018

*   Support `ceph-dual`.

##  [0.6.2] - Dec 4th, 2018

*   Fixed the bug on `fs2ceph()` when option `filter` exists.

##  [0.6.1] - Nov 12th, 2018

Some wonderful optimizations are made in this version:
*   If filename contains no-utf8 characters, an exception will be thrown on running `fs2ceph()` in Linux. In this version, such files will be ignored and an event named __no-utf8-filename__ will be emitted. In cli mode, such cases will be output to log file named __no-utf8-filename.log__。
*   If the waiting queue becomes longer and longer, `out of memory` exception may be thrown and the process will be terminated. So, a new option named `maxQueueing` with default value 100,000 is now accepted by `fs2ceph()`. When the ceil is touched, the waiting queue will be frozen in 1,000 ms (one second).

Fixed bugs:
*   In previous version, skipped filenames are stored in __ignore.log__ while they SHOULD be stored in __skipped.log__. Now this bug is fixed.

##  [0.6.0] - Nov 8th, 2018

*   New option `--filter` and `--dual-meta-filter` available on synchronising from filesystem to ceph storage.

##  [0.5.0] - Aug 20th, 2018

*   Fixed the bug when connection's container is changed during sync progress.

##  [0.4.1] - Aug 3rd, 2018

*   New command option `--concurrency` accepted.

##  [0.4.0] - Aug 2nd, 2018

*   Upgrade dependency version of `ceph`.
*   Fixed the bug in `ceph2fs` that exception thrown if there is really an object named with slash "/" tailed. Now, such object will be ignored directly.

##  [0.3.1] - May 13th, 2018

*   Update version of dependency __[jinang](https://www.npmjs.com/package/jinang)__ which is necessary.

##  [0.3.0] - May 13th, 2018 - @unpublished

*   Command options `--fill` accepted.

##  [0.2.0] - Apr 23rd, 2018

*   Dependencies upgraded.
*   Command options `--source-container` and `--target-container` accepted.

##	[0.1.2] - Feb 9th, 2018

*	`--mapper` option added in CLI mode.

##	[0.1.1] - Feb 8th, 2018

##	[0.0.1] - Jan 09, 2018

Released.

---
This CHANGELOG.md follows [*Keep a CHANGELOG*](http://keepachangelog.com/).
