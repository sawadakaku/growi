'use strict';

var form = require('express-form')
  , field = form.field;

module.exports = form(
  field('settingForm[gcs:bucket]', 'バケット名').trim(),
  field('settingForm[gcs:projectId]', 'Access Key Id').trim(),
);

