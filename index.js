var debug = require('debug')('gcloud-put-dir');

var fs = require('fs');
var gcloud = require('google-cloud');
var through = require('through2');
var concurrent = require('through2-concurrent');
var from = require('from2-array');
var pump = require('pump');
var EventEmitter = require('events').EventEmitter

module.exports = GCloudSiteDir;

/**
 * @param {object}   opts Options
 * @param {string}   opts.keyFile   Path to Google Project json file
 * @param {string}   opts.directory Path to directory to upload
 * @param {string}   opts.siteName  Name of site
 * @param {string}   opts.directoryPrefix  Directory path to push the
 *                                         local directory to
 * @param {boolean}  opts.gitSuffix?  Should the bucket include a git
 *                                    branch suffix
 * @param {boolean}  opts.gitSubdomain?  Should the bucket include a git
 *                                       branch subdomain
 * @param {Function} cb   Called with (error|undefined) on complete
 */
function GCloudSiteDir (opts, cb) {
  if ( typeof cb !== 'function' ) cb = function noop () {}

  var keyFilePath = replaceHomePath( opts.keyFile )
  var directory = replaceHomePath( opts.directory )

  var options = {
    gcloud:    { projectId: projectIdFromKeyFile( keyFilePath ), keyFilename: keyFilePath },
    directory: directory,
    bucket:    opts.siteName,
    gitSuffix: opts.gitSuffix,
    gitSubdomain: opts.gitSubdomain,
    dirPrefix: opts.directoryPrefix,
  }

  debug(options);

  var source = from.obj([options]);

  var emitter = new EventEmitter();

  var pipeline = [source];

    if (opts.gitSuffix)
        pipeline = pipeline
            .concat([GitSuffix()]);

    if (opts.gitSubdomain)
        pipeline = pipeline
          .concat([GitSubdomain()])

    pipeline = pipeline
        .concat([
            CreateBucketWith(),
            UploadFiles( emitter )
        ]);

  pump.apply(null, pipeline.concat([ cb ]) );

  return emitter;
}

function projectIdFromKeyFile( keyFile ) {
  try {
    return JSON.parse( fs.readFileSync( keyFile ).toString() ).project_id;
  } catch ( error ) {
    return error
  }
}

function replaceHomePath ( path ) {
  if ( path.startsWith( '~' ) ) {
    path = path.replace( '~', getUserHome() )
  }
  return path
}

function getUserHome() {
  return process.env[ (process.platform == 'win32')
      ? 'USERPROFILE'
      : 'HOME'
    ];
}

function gitBranch (callback) {
  var git = require('git-state');

  var branchNameFrom = function (branch) {
    return branch.toLowerCase().replace(/(\s|\/)/g, '-')
  }

  try {
    git.branch('.', function (error, branch) {
      callback(undefined, branchNameFrom(branch))
    })
  } catch (noGitError) {
    callback(undefined, '')
  }

}

function gitBranchModifyBucket (nameFn) {
  return through.obj(modifyBucket);

  function modifyBucket (conf, enc, next) {
    gitBranch(function(branch) {
      conf.bucket = nameFn(conf.bucket, branch)
      next(null, conf)
    })
  }
}

function GitSubdomain () {

  var gitBranchSubdomain = function (siteName, branchName) {
    return [branchName, siteName].join('.');
  }

  return gitBranchModifyBucket(gitBranchSubdomain);
}

function GitSuffix () {

  var gitBranchSuffix = function (siteName, branchName) {
    var siteNameParts = siteName.split('.')
    var siteNametoSuffix = siteNameParts.slice(0,1)
    var domain = siteNameParts.slice(1).join('.')

    var subdomain = [ siteNametoSuffix, branchName ].join('-')
    return [ subdomain, domain ].join('.')
  }

  return gitBranchModifyBucket(gitBranchSuffix)
}

function CreateBucketWith () {
  return through.obj(createBucket);

  function createBucket (conf, enc, next) {
    var gcs = gcloud.storage(conf.gcloud);
    debug(gcs)
    debug(gcs.config)

    var m = [
      'Ensuring gcloud bucket exists: ', conf.bucket
    ];
    debug(m.join(''));

    var self = this;

    if (conf.bucket === false) {
      var e = [
          'Creating gcloud bucket requires ',
          'a name, in this case, the ',
          'current git branch.'
      ];
      throw new Error(e.join(''));
    } else {
      var step = function (fn) {
        var bail = finish;
        return through.obj(function (row, enc, nextStep) {
          fn.apply(this, [row, nextStep, bail]);
        });
      }

      var bucketExists = step( function (conf, nextStep, bail) {
        debug('Does the bucket exist?: ' + conf.bucket)
        gcs.bucket(conf.bucket).exists(function (existsError, exists) {
          if ( existsError ) return bail( existsError )
          conf.bucketExists = exists;
          return nextStep( null, conf )
        })
      } )

      var createBucket = step(function (conf, nextStep, bail) {
        if ( conf.bucketExists === true ) return nextStep(null, conf);

        debug('Create bucket: ' + conf.bucket);
        gcs.createBucket(conf.bucket, function (createError, bucket) {
          if (createError) {
            var ALREADY_OWNED_ERROR_MESSAGE =
              'You already own this bucket. Please select another name.'
            var DOMAIN_VERIFICATION_ERROR =
              'The bucket you tried to create requires domain ownership verification.'
            if ((createError.message !== ALREADY_OWNED_ERROR_MESSAGE) &&
                (createError.message !== DOMAIN_VERIFICATION_ERROR)) {
              return bail(createError)
            }
          }
          return nextStep(null, conf);
        })
      })

      var addAcl = function (aclOptions) {
        return step(function (conf, nextStep, bail) {
          debug( 'add-acl' )
          gcs.bucket(conf.bucket).acl.add(aclOptions, function (aclError, aclObject) {
            if (aclError) return bail(aclError)
            else return nextStep(null, conf)
          });
        })
      }

      var addDefaultAcl = function (aclOptions) {
        return step(function (conf, nextStep, bail) {
          debug( 'add-default' )
          gcs.bucket(conf.bucket).acl.default.add(aclOptions, function (aclError, aclObject) {
            if (aclError) return bail(aclError)
            else return nextStep(null, conf)
          });
        })
      }

      var setMetadata = function () {
        var metadata = {
          website: {
            mainPageSuffix: 'index.html',
            notFoundPage: '404.html',
          }
        }

        return step(function (conf, nextStep, bail) {
          debug( 'set-metadata' )
          gcs.bucket(conf.bucket).setMetadata(metadata, nextStep)
        });
      }

      from.obj([conf])
        .pipe(bucketExists)
        .pipe(createBucket)
        .pipe(addAcl({ entity: 'allUsers', role: gcs.acl.READER_ROLE }))
        .pipe(addDefaultAcl({ entity: 'allUsers', role: gcs.acl.READER_ROLE }))
        .pipe(setMetadata())
        .on('finish', finish)
    }

    function finish (error, data) {
      if (error) {
        debug(error, error.stack);
        return next(error);
      }
      self.push(conf);
      next();
    }
  }
}

function UploadFiles ( emitter ) {
  var readdirp = require('readdirp');

  return through.obj(uploads);

  function uploads (conf, enc, next) {
    var stream = this;

    var m = [
      'Uploading to gcloud bucket ', conf.bucket
    ];
    debug(m.join(' '));

    var files = readdirp({
        root: conf.directory,
        directoryFilter: ['!.git', '!cache']
      })
      .on('error', function (err) {
        console.log(err.message);
      });

    var prefixer = through.obj(function (row, enc, done) {
        debug(row);
        if (conf.dirPrefix) {
          row.path = [conf.dirPrefix, row.path].join('/');
        }
        this.push(row);
        done();
      });

    var uploader = gcloudSync(conf.gcloud, conf.bucket)
      .on('data', function (file) {
          debug(file.url);
          emitter.emit( 'uploaded', file )
      })
      .on('error', debug)
      .on('end', function () {
          debug('Done starting uploads.');
          next();
      });

    files.pipe(prefixer).pipe(uploader);
  }
}

function gcloudSync (gcloudConf, bucket) {
  var max_attempts = 6;

  var gcs = gcloud.storage(gcloudConf);
  var gcsBucket = gcs.bucket(bucket);
  var uploadOptions = function ( destination ) {
    return {
      destination: destination,
      metadata: {
        cacheControl: 'no-cache'
      }
    }
  }

  var syncFile = function (src, dest, next) {
    var attempt = 0;
    gcsBucket.upload(src, uploadOptions( dest ), function (error, file) {
      var url = [bucket, dest].join('/');
      if (error) {
        attempt += 1
        if (attempt <= max_attempts) {
          return setTimeout(function retry () {
            syncFile(src, dest, next)
          }, backoffTime( attempt ) )
        } else {
          return next( error )
        }
      }
      debug('finished uploading: ' + url)
      next(error, url)
    });
  }

  var uploader = concurrent.obj( { maxConcurrency: 10 }, function (row, enc, next) {
    syncFile(row.fullPath, row.path, function (error, url) {
      row.url = url;
      next(error, row);
    })
  });

  return uploader;
}

function backoffTime (attempt) {
  var backoff = Math.pow(2, attempt);
  var maxBackoffTime = 32000;
  var randomOffset = Math.random() * 10;
  return Math.min(backoff, maxBackoffTime) + randomOffset;
}
