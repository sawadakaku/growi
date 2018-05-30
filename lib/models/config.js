module.exports = function(crowi) {
  var mongoose = require('mongoose')
    , debug = require('debug')('growi:models:config')
    , uglifycss = require('uglifycss')
    , configSchema
    , Config

    , SECURITY_RESTRICT_GUEST_MODE_DENY = 'Deny'
    , SECURITY_RESTRICT_GUEST_MODE_READONLY = 'Readonly'

    , SECURITY_REGISTRATION_MODE_OPEN = 'Open'
    , SECURITY_REGISTRATION_MODE_RESTRICTED = 'Resricted'
    , SECURITY_REGISTRATION_MODE_CLOSED = 'Closed'
  ;

  configSchema = new mongoose.Schema({
    ns: { type: String, required: true, index: true },
    key: { type: String, required: true, index: true },
    value: { type: String, required: true }
  });

  /**
   * default values when GROWI is cleanly installed
   */
  function getArrayForInstalling() {
    let config = getDefaultCrowiConfigs();

    // overwrite
    config['app:fileUpload'] = true;
    config['security:isEnabledPassport'] = true;
    config['customize:behavior'] = 'growi';
    config['customize:layout'] = 'growi';
    config['customize:isSavedStatesOfTabChanges'] = false;

    return config;
  }

  /**
   * default values when migrated from Official Crowi
   */
  function getDefaultCrowiConfigs() {
    /* eslint-disable key-spacing */
    return {
      //'app:installed'     : "0.0.0",
      'app:confidential'  : '',

      'app:fileUpload'    : false,

      'security:restrictGuestMode'      : 'Deny',

      'security:registrationMode'      : 'Open',
      'security:registrationWhiteList' : [],

      'security:isEnabledPassport' : false,
      'security:passport-ldap:isEnabled' : false,
      'security:passport-ldap:serverUrl' : undefined,
      'security:passport-ldap:isUserBind' : undefined,
      'security:passport-ldap:bindDN' : undefined,
      'security:passport-ldap:bindDNPassword' : undefined,
      'security:passport-ldap:searchFilter' : undefined,
      'security:passport-ldap:attrMapUsername' : undefined,
      'security:passport-ldap:groupSearchBase' : undefined,
      'security:passport-ldap:groupSearchFilter' : undefined,
      'security:passport-ldap:groupDnProperty' : undefined,
      'security:passport-ldap:isSameUsernameTreatedAsIdenticalUser': false,

      'aws:bucket'          : 'growi',
      'aws:region'          : 'ap-northeast-1',
      'aws:accessKeyId'     : '',
      'aws:secretAccessKey' : '',

      'gcs:bucket'          : 'growi',
      'gcs:keyFilename'     : '',
      'gcs:projectId'       : '',

      'mail:from'         : '',
      'mail:smtpHost'     : '',
      'mail:smtpPort'     : '',
      'mail:smtpUser'     : '',
      'mail:smtpPassword' : '',

      'google:clientId'     : '',
      'google:clientSecret' : '',

      'plugin:isEnabledPlugins' : true,

      'customize:css' : '',
      'customize:script' : '',
      'customize:header' : '',
      'customize:title' : '',
      'customize:highlightJsStyle' : 'github',
      'customize:highlightJsStyleBorder' : false,
      'customize:theme' : 'default',
      'customize:behavior' : 'crowi',
      'customize:layout' : 'crowi',
      'customize:isEnabledTimeline' : true,
      'customize:isSavedStatesOfTabChanges' : true,
      'customize:isEnabledAttachTitleHeader' : false,
    };
    /* eslint-enable */
  }

  function getDefaultMarkdownConfigs() {
    return {
      'markdown:isEnabledLinebreaks': true,
      'markdown:isEnabledLinebreaksInComments': true,
    };
  }

  function getValueForCrowiNS(config, key) {
    // return the default value if undefined
    if (undefined === config.crowi || undefined === config.crowi[key]) {
      return getDefaultCrowiConfigs()[key];
    }

    return config.crowi[key];
  }

  configSchema.statics.getRestrictGuestModeLabels = function() {
    var labels = {};
    labels[SECURITY_RESTRICT_GUEST_MODE_DENY]     = 'security_setting.guest_mode.deny';
    labels[SECURITY_RESTRICT_GUEST_MODE_READONLY] = 'security_setting.guest_mode.readonly';

    return labels;
  };

  configSchema.statics.getRegistrationModeLabels = function() {
    var labels = {};
    labels[SECURITY_REGISTRATION_MODE_OPEN]       = 'security_setting.registration_mode.open';
    labels[SECURITY_REGISTRATION_MODE_RESTRICTED] = 'security_setting.registration_mode.restricted';
    labels[SECURITY_REGISTRATION_MODE_CLOSED]     = 'security_setting.registration_mode.closed';

    return labels;
  };

  configSchema.statics.updateConfigCache = function(ns, config) {
    var originalConfig = crowi.getConfig();
    var newNSConfig = originalConfig[ns] || {};
    Object.keys(config).forEach(function(key) {
      if (config[key] || config[key] === '' || config[key] === false) {
        newNSConfig[key] = config[key];
      }
    });

    originalConfig[ns] = newNSConfig;
    crowi.setConfig(originalConfig);

    // initialize custom css/script
    Config.initCustomCss(originalConfig);
    Config.initCustomScript(originalConfig);
  };

  // Execute only once for installing application
  configSchema.statics.applicationInstall = function(callback) {
    var Config = this;
    Config.count({ ns: 'crowi' }, function(err, count) {
      if (count > 0) {
        return callback(new Error('Application already installed'), null);
      }
      Config.updateNamespaceByArray('crowi', getArrayForInstalling(), function(err, configs) {

        Config.updateConfigCache('crowi', configs);
        return callback(err, configs);
      });
    });
  };

  configSchema.statics.setupCofigFormData = function(ns, config) {
    var defaultConfig = {};

    // set Default Settings
    if (ns === 'crowi') {
      defaultConfig = getDefaultCrowiConfigs();
    }
    else if (ns === 'markdown') {
      defaultConfig = getDefaultMarkdownConfigs();
    }

    if (!defaultConfig[ns]) {
      defaultConfig[ns] = {};
    }
    Object.keys(config[ns] || {}).forEach(function(key) {
      if (config[ns][key] !== undefined) {
        defaultConfig[key] = config[ns][key];
      }
    });
    return defaultConfig;
  };


  configSchema.statics.updateNamespaceByArray = function(ns, configs, callback) {
    var Config = this;
    if (configs.length < 0) {
      return callback(new Error('Argument #1 is not array.'), null);
    }

    Object.keys(configs).forEach(function(key) {
      var value = configs[key];

      Config.findOneAndUpdate(
        { ns: ns, key: key },
        { ns: ns, key: key, value: JSON.stringify(value) },
        { upsert: true, },
        function(err, config) {
          debug('Config.findAndUpdate', err, config);
        });
    });

    return callback(null, configs);
  };

  configSchema.statics.findAndUpdate = function(ns, key, value, callback) {
    var Config = this;
    Config.findOneAndUpdate(
      { ns: ns, key: key },
      { ns: ns, key: key, value: JSON.stringify(value) },
      { upsert: true, },
      function(err, config) {
        debug('Config.findAndUpdate', err, config);
        callback(err, config);
      });
  };

  configSchema.statics.getConfig = function(callback) {
  };

  configSchema.statics.loadAllConfig = function(callback) {
    var Config = this
      , config = {};
    config.crowi = {}; // crowi namespace

    Config.find()
      .sort({ns: 1, key: 1})
      .exec(function(err, doc) {

        doc.forEach(function(el) {
          if (!config[el.ns]) {
            config[el.ns] = {};
          }
          config[el.ns][el.key] = JSON.parse(el.value);
        });

        debug('Config loaded', config);

        // initialize custom css/script
        Config.initCustomCss(config);
        Config.initCustomScript(config);

        return callback(null, config);
      });
  };

  configSchema.statics.appTitle = function(config) {
    const key = 'app:title';
    return getValueForCrowiNS(config, key) || 'GROWI';
  };

  configSchema.statics.isEnabledPassport = function(config) {
    // always true if growi installed cleanly
    if (Object.keys(config.crowi).length == 0) {
      return true;
    }

    const key = 'security:isEnabledPassport';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isEnabledPassportLdap = function(config) {
    const key = 'security:passport-ldap:isEnabled';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isSameUsernameTreatedAsIdenticalUser = function(config, providerType) {
    const key = `security:passport-${providerType}:isSameUsernameTreatedAsIdenticalUser`;
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isUploadable = function(config) {
    var method = crowi.env.FILE_UPLOAD || 'aws';

    if (method == 'aws' && (
      !config.crowi['aws:accessKeyId'] ||
        !config.crowi['aws:secretAccessKey'] ||
        !config.crowi['aws:region'] ||
        !config.crowi['aws:bucket'])) {
      return false;
    }

    if (method == 'gcs' && (
        !config.crowi['gcs:projectId'] ||
        !config.crowi['gcs:keyFilename'] ||
        !config.crowi['gcs:bucket'])) {
      return false;
    }

    return method != 'none';
  };

  configSchema.statics.isGuesstAllowedToRead = function(config) {
    // return false if undefined
    if (undefined === config.crowi || undefined === config.crowi['security:restrictGuestMode']) {
      return false;
    }

    return SECURITY_RESTRICT_GUEST_MODE_READONLY === config.crowi['security:restrictGuestMode'];
  };

  configSchema.statics.isEnabledPlugins = function(config) {
    const key = 'plugin:isEnabledPlugins';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isEnabledLinebreaks = function(config) {
    const key = 'markdown:isEnabledLinebreaks';

    // return default value if undefined
    if (undefined === config.markdown || undefined === config.markdown[key]) {
      return getDefaultMarkdownConfigs[key];
    }

    return config.markdown[key];
  };

  configSchema.statics.isEnabledLinebreaksInComments = function(config) {
    const key = 'markdown:isEnabledLinebreaksInComments';

    // return default value if undefined
    if (undefined === config.markdown || undefined === config.markdown[key]) {
      return getDefaultMarkdownConfigs[key];
    }

    return config.markdown[key];
  };

  /**
   * initialize custom css strings
   */
  configSchema.statics.initCustomCss = function(config) {
    const key = 'customize:css';
    const rawCss = getValueForCrowiNS(config, key);
    // uglify and store
    this._customCss = uglifycss.processString(rawCss);
  };

  configSchema.statics.customCss = function(config) {
    return this._customCss;
  };

  configSchema.statics.initCustomScript = function(config) {
    const key = 'customize:script';
    const rawScript = getValueForCrowiNS(config, key);
    // store as is
    this._customScript = rawScript;
  };

  configSchema.statics.customScript = function(config) {
    return this._customScript;
  };

  configSchema.statics.customHeader = function(config) {
    const key = 'customize:header';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.theme = function(config) {
    const key = 'customize:theme';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.customTitle = function(config, page) {
    const key = 'customize:title';
    let customTitle = getValueForCrowiNS(config, key);

    if (customTitle == null || customTitle.trim().length == 0) {
      customTitle = '{{page}} - {{sitename}}';
    }

    return customTitle
      .replace('{{sitename}}', this.appTitle(config))
      .replace('{{page}}', page);
  };

  configSchema.statics.behaviorType = function(config) {
    const key = 'customize:behavior';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.layoutType = function(config) {
    const key = 'customize:layout';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.highlightJsStyle = function(config) {
    const key = 'customize:highlightJsStyle';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.highlightJsStyleBorder = function(config) {
    const key = 'customize:highlightJsStyleBorder';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isEnabledTimeline = function(config) {
    const key = 'customize:isEnabledTimeline';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isSavedStatesOfTabChanges = function(config) {
    const key = 'customize:isSavedStatesOfTabChanges';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.isEnabledAttachTitleHeader = function(config) {
    const key = 'customize:isEnabledAttachTitleHeader';
    return getValueForCrowiNS(config, key);
  };

  configSchema.statics.fileUploadEnabled = function(config) {
    const Config = this;

    if (!Config.isUploadable(config)) {
      return false;
    }

    // convert to boolean
    return !!config.crowi['app:fileUpload'];
  };

  configSchema.statics.hasSlackConfig = function(config) {
    return Config.hasSlackToken(config) || Config.hasSlackIwhUrl(config);
  };

  /**
   * for Slack Incoming Webhooks
   */
  configSchema.statics.hasSlackIwhUrl = function(config) {
    if (!config.notification) {
      return false;
    }
    return (config.notification['slack:incomingWebhookUrl'] ? true : false);
  };

  configSchema.statics.isIncomingWebhookPrioritized = function(config) {
    if (!config.notification) {
      return false;
    }
    return (config.notification['slack:isIncomingWebhookPrioritized'] ? true : false);
  };

  configSchema.statics.hasSlackToken = function(config) {
    if (!config.notification) {
      return false;
    }

    return (config.notification['slack:token'] ? true : false);
  };

  configSchema.statics.getLocalconfig = function(config) {
    const Config = this;
    const env = crowi.getEnv();

    const local_config = {
      crowi: {
        title: Config.appTitle(crowi),
        url: config.crowi['app:url'] || '',
      },
      upload: {
        image: Config.isUploadable(config),
        file: Config.fileUploadEnabled(config),
      },
      behaviorType: Config.behaviorType(config),
      layoutType: Config.layoutType(config),
      isEnabledLineBreaks: Config.isEnabledLinebreaks(config),
      highlightJsStyleBorder: Config.highlightJsStyleBorder(config),
      isSavedStatesOfTabChanges: Config.isSavedStatesOfTabChanges(config),
      env: {
        PLANTUML_URI: env.PLANTUML_URI || null,
        MATHJAX: env.MATHJAX || null,
      },
    };

    return local_config;
  };

  /*
  configSchema.statics.isInstalled = function(config)
  {
    if (!config.crowi) {
      return false;
    }

    if (config.crowi['app:installed']
       && config.crowi['app:installed'] !== '0.0.0') {
      return true;
    }

    return false;
  }
  */

  Config = mongoose.model('Config', configSchema);
  Config.SECURITY_REGISTRATION_MODE_OPEN       = SECURITY_REGISTRATION_MODE_OPEN;
  Config.SECURITY_REGISTRATION_MODE_RESTRICTED = SECURITY_REGISTRATION_MODE_RESTRICTED;
  Config.SECURITY_REGISTRATION_MODE_CLOSED     = SECURITY_REGISTRATION_MODE_CLOSED;


  return Config;
};
