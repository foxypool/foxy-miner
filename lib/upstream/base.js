const EventEmitter = require('events');
const submitProbabilityMixin = require('./mixins/submit-probability-mixin');
const outageDetectionMixin = require('./mixins/outage-detection-mixin');
const configMixin = require('./mixins/config-mixin');
const haltMiningMixin = require('./mixins/halt-mining-mixin');

module.exports = configMixin(haltMiningMixin(outageDetectionMixin(submitProbabilityMixin(EventEmitter))));
