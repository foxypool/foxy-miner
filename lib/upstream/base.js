const EventEmitter = require('events');
const submitProbabilityMixin = require('./mixins/submit-probability-mixin');
const outageDetectionMixin = require('./mixins/outage-detection-mixin');
const configMixin = require('./mixins/config-mixin');

module.exports = configMixin(outageDetectionMixin(submitProbabilityMixin(EventEmitter)));
