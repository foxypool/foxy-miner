const EventEmitter = require('events');
const submitProbabilityMixin = require('./mixins/submit-probability-mixin');
const outageDetectionMixin = require('./mixins/outage-detection-mixin');

module.exports = outageDetectionMixin(submitProbabilityMixin(EventEmitter));
