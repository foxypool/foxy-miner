const eventBus = require('../../services/event-bus');

module.exports = (upstreamClass) => class OutageDetectionMixin extends upstreamClass {
  constructor() {
    super();
    this.connected = true;
    this.smoothedConnectionState = this.connected;
    this.prevConnectionState = this.connected;
    this.connectionStateCounter = 0;
    this.connectionOutageCounterThreshold = 2;
    setInterval(this.detectConnectionOutage.bind(this), 1000);
  }

  async init() {
    const updateMiningInfoInterval = this.upstreamConfig.updateMiningInfoInterval ? this.upstreamConfig.updateMiningInfoInterval : 1000;
    this.connectionOutageCounterThreshold = Math.round(updateMiningInfoInterval / 1000) * 2;
    if (super.init) {
      await super.init();
    }
  }

  detectConnectionOutage() {
    this.prevConnectionState = this.smoothedConnectionState;

    if (this.connected) {
      this.smoothedConnectionState = true;
      this.connectionStateCounter = 0;
    } else if (this.smoothedConnectionState !== this.connected) {
      this.connectionStateCounter += 1;
    } else {
      this.connectionStateCounter = 0;
    }

    if (this.connectionStateCounter > this.connectionOutageCounterThreshold) {
      this.smoothedConnectionState = this.connected;
      this.connectionStateCounter = 0;
    }

    if (this.prevConnectionState && !this.smoothedConnectionState) {
      eventBus.publish('log/error', `${this.upstreamName} | Connection outage detected ..`);
    } else if (!this.prevConnectionState && this.smoothedConnectionState) {
      eventBus.publish('log/error', `${this.upstreamName} | Connection outage resolved`);
    }
  }
};