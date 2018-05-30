// crowi-fileupload-local

module.exports = function(crowi) {
  'use strict';

  var debug = require('debug')('growi:lib:fileUploaderGcs')
    , fs = require('fs')
    , path = require('path')
    , mkdir = require('mkdirp')
    , Storage = require('@google-cloud/storage')
    , lib = {}
    , getGcsConfig = function() {
      var config = crowi.getConfig();
      return {
        projectId: config.crowi['gcs:projectId'],
        keyFilename: config.crowi['gcs:keyFilename'],
        bucket: config.crowi['gcs:bucket'],
      };
    };

  function StorageFactory() {
    const gcsConfig = getGcsConfig();
    const Config = crowi.model('Config');
    const config = crowi.getConfig();

    if (!Config.isUploadable(config)) {
      throw new Error('GCS is not configured.');
    }

    var gcs_config = {
      projectId: gcsConfig.projectId,
      keyFilename: gcsConfig.keyFilename,
    };

    return new Storage(gcs_config);
  }

  lib.deleteFile = function(fileId, filePath) {
    const storage = StorageFactory();
    const gcsConfig = getGcsConfig();
    const bucket = storage.bucket(gcsConfig.bucket);
    debug('File deletion: ' + filePath);
    return new Promise(function(resolve, reject) {
      var file = bucket.file(filePath);
      file.delete(function(err) {
        if (err) {
          debug(err);
          return reject(err);
        }
        // asynclonousely delete cache
        lib.clearCache(fileId);
        resolve();
      });
    });
  };

  lib.uploadFile = function(filePath, contentType, fileStream, options) {
    const storage = StorageFactory();
    const gcsConfig = getGcsConfig();
    const bucket = storage.bucket(gcsConfig.bucket);

    debug('File uploading: ' + filePath);
    return new Promise(function(resolve, reject) {
        var file = bucket.file(filePath);
        var options = {
          entity: 'allUsers',
          role: storage.acl.READER_ROLE
        };
        file.acl.add(options, function(err, aclObject) {});        
        var writer = file.createWriteStream();

        writer.on('error', function(err) {
          reject(err);
        }).on('finish', function() {
          resolve();
        });

        fileStream.pipe(writer);
    });
  };

  lib.generateUrl = function(filePath) {
    console.log('generateUrl');
    var gcsConfig = getGcsConfig()
      , url = 'https://storage.cloud.google.com/' + gcsConfig.bucket + '/' + filePath;

    return url;
  };

  lib.findDeliveryFile = function(fileId, filePath) {
    console.log('findDeliveryFile');
    var cacheFile = lib.createCacheFileName(fileId);

    return new Promise((resolve, reject) => {
      debug('find delivery file', cacheFile);
      if (!lib.shouldUpdateCacheFile(cacheFile)) {
        return resolve(cacheFile);
      }

      var loader = require('https');

      var fileStream = fs.createWriteStream(cacheFile);
      var fileUrl = lib.generateUrl(filePath);
      debug('Load attachement file into local cache file', fileUrl, cacheFile);
      loader.get(fileUrl, function(response) {
        response.pipe(fileStream, { end: false });
        response.on('end', () => {
          fileStream.end();
          resolve(cacheFile);
        });
      });
    });
  };

  lib.clearCache = function(fileId) {
    const cacheFile = lib.createCacheFileName(fileId);

    (new Promise((resolve, reject) => {
      fs.unlink(cacheFile, (err) => {
        if (err) {
          debug('Failed to delete cache file', err);
          // through
        }

        resolve();
      });
    })).then(data => {
      // success
    }).catch(err => {
      debug('Failed to delete cache file (file may not exists).', err);
      // through
    });
  };

  // private
  lib.createCacheFileName = function(fileId) {
    return path.join(crowi.cacheDir, `attachment-${fileId}`);
  };

  // private
  lib.shouldUpdateCacheFile = function(filePath) {
    try {
      var stats = fs.statSync(filePath);

      if (!stats.isFile()) {
        debug('Cache file not found or the file is not a regular fil.');
        return true;
      }

      if (stats.size <= 0) {
        debug('Cache file found but the size is 0');
        return true;
      }
    }
    catch (e) {
      // no such file or directory
      debug('Stats error', e);
      return true;
    }

    return false;
  };


  return lib;
};


