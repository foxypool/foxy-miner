#!/usr/bin/env node

const bodyParser = require('koa-bodyparser');
const chalk = require('chalk');
const http = require('http');
const Integrations = require('@sentry/integrations');
const Koa = require('koa');
const Router = require('koa-router');
const Sentry = require('@sentry/node');
const program = require('commander');
const { flatten } = require('lodash');

const eventBus = require('./lib/services/event-bus');
const logger = require('./lib/services/logger');
const config = require('./lib/services/config');
const Proxy = require('./lib/proxy');
const store = require('./lib/services/store');
const version = require('./lib/version');
const Scavenger = require('./lib/miner/scavenger');
const Conqueror = require('./lib/miner/conqueror');
const IdleProgram = require('./lib/idle-program');
const startupMessage = require('./lib/startup-message');
const profitabilityService = require('./lib/services/profitability-service');
const dashboard = require('./lib/services/cli-dashboard');
const foxyPoolGateway = require('./lib/services/foxy-pool-gateway');

program
  .version(version)
  .option('--config <foxy-miner.yaml>', 'The custom foxy miner config.yaml file path')
  .option('--live', 'Show a live dashboard with stats')
  .parse(process.argv);

if (program.config) {
  store.configFilePath = program.config;
}
if (program.live) {
  store.useDashboard = true;
  dashboard.init();
}

(async () => {
  await config.init();

  startupMessage();

  Sentry.init({
    dsn: 'https://2c5b7b184ad44ed99fc457f4442386e9@sentry.io/1462805',
    release: `foxy-miner@${version}`,
    attachStacktrace: true,
    integrations: [
      new Integrations.Dedupe(),
      new Integrations.ExtraErrorData(),
      new Integrations.Transaction(),
    ],
    ignoreErrors: [
      /ENOSYS/
    ],
  });

  process.on('unhandledRejection', (err) => {
    eventBus.publish('log/error', `Error: ${err.message}`);
  });
  process.on('uncaughtException', (err) => {
    eventBus.publish('log/error', `Error: ${err.message}`);
  });

  const app = new Koa();
  app.on('error', err => {
    eventBus.publish('log/error', `Error: ${err.message}`);
  });

  const router = new Router();
  app.use(bodyParser());

  if (config.useProfitability) {
    await profitabilityService.init(config.useEcoBlockRewardsForProfitability);
  }

  const minerConfigs = config.miner ? config.miner.filter(minerConfig => !minerConfig.disabled) : [{
    upstreams: config.upstreams,
    minerBinPath: config.minerBinPath,
    minerConfigPath: config.minerConfigPath,
    minerType: config.minerType,
    minerOutputToConsole: config.minerOutputToConsole,
    assumeScannedAfter: config.config.assumeScannedAfter,
  }];

  const singleProxy = minerConfigs.length === 1;
  const proxies = minerConfigs.map((minerConfig, index) => {
    const proxyIndex = index + 1;

    let miner = null;
    switch (minerConfig.minerType) {
      case 'scavenger':
        miner = new Scavenger(minerConfig.minerBinPath, minerConfig.minerConfigPath, minerConfig.minerOutputToConsole);
        break;
      case 'conqueror':
        miner = new Conqueror(minerConfig.minerBinPath, minerConfig.minerConfigPath, minerConfig.minerOutputToConsole);
        break;
    }

    const enabledUpstreams = minerConfig.upstreams.filter(upstreamConfig => !upstreamConfig.disabled);
    const proxy = new Proxy({
      upstreamConfigs: enabledUpstreams,
      proxyIndex,
      showProxyIndex: !singleProxy,
      miner,
      minerConfig: minerConfig,
    });
    miner.proxy = proxy;

    const endpoints = [`/${index + 1}/burst`];
    if (singleProxy) {
      endpoints.unshift('/burst');
    }
    for (let endpoint of endpoints) {
      router.get(endpoint, (ctx) => {
        const requestType = ctx.query.requestType;
        switch (requestType) {
          case 'getMiningInfo':
            ctx.body = proxy.getMiningInfo();
            break;
          default:
            eventBus.publish('log/error', `Unknown requestType ${requestType} with data: ${JSON.stringify(ctx.params)}. Please message this info to the creator of this software.`);
            ctx.status = 400;
            ctx.body = {
              error: {
                message: 'unknown request type',
                code: 4,
              },
            };
        }
      });
      router.post(endpoint, async (ctx) => {
        const requestType = ctx.query.requestType;
        switch (requestType) {
          case 'getMiningInfo':
            ctx.body = proxy.getMiningInfo();
            break;
          case 'submitNonce':
            const options = {
              ip: ctx.request.ip,
              maxScanTime: ctx.params.maxScanTime,
              minerName: ctx.req.headers['x-minername'] || ctx.req.headers['x-miner'],
              userAgent: ctx.req.headers['user-agent'],
              miner: ctx.req.headers['x-miner'],
              capacity: parseInt(ctx.req.headers['x-capacity']),
              accountKey: ctx.req.headers['x-account'],
              accountName: ctx.req.headers['x-accountname'] || ctx.req.headers['x-mineralias'] || null,
              color: ctx.req.headers['x-color'] || null,
            };
            const submissionObj = {
              accountId: ctx.query.accountId,
              blockheight: ctx.query.blockheight,
              nonce: ctx.query.nonce,
              deadline: ctx.query.deadline,
              secretPhrase: ctx.query.secretPhrase !== '' ? ctx.query.secretPhrase : null,
            };
            ctx.body = await proxy.submitNonce(submissionObj, options);
            if (ctx.body.error) {
              ctx.status = 400;
            }
            break;
          default:
            eventBus.publish('log/error', `Unknown requestType ${requestType} with data: ${JSON.stringify(ctx.params)}. Please message this info to the creator of this software.`);
            ctx.status = 400;
            ctx.body = {
              error: {
                message: 'unknown request type',
                code: 4,
              },
            };
        }
      });
    }

    return {
      miner,
      proxy,
    };
  });

  if (store.useDashboard) {
    dashboard.proxies = proxies.map(({proxy}) => proxy);
    dashboard.start();
  }

  const coins = [...new Set(flatten(proxies.map(({proxy}) =>
    proxy.upstreamConfigs
      .filter(upstreamConfig => upstreamConfig.type === 'foxypool' && upstreamConfig.coin && !upstreamConfig.url)
      .map(upstreamConfig => upstreamConfig.coin.toUpperCase())
  )))];
  if (coins.length > 0) {
    foxyPoolGateway.coins = coins;
    await foxyPoolGateway.init();
  }

  await Promise.all(proxies.map(({proxy}) => proxy.init()));

  app.use(router.routes());
  app.use(router.allowedMethods());

  const server = http.createServer(app.callback());

  server.on('error', (err) => {
    eventBus.publish('log/error', `Error: ${err.message}`);
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      process.exit(1);
    }
  });

  server.listen(config.listenPort, config.listenHost);

  const startupLine = `Foxy-Miner ${version} initialized`;
  eventBus.publish('log/info', store.getUseColors() ? chalk.green(startupLine) : startupLine);
  proxies.map((data, index) => {
    const listenLine = `Accepting connections on http://${config.listenAddr}${singleProxy ? '' : '/' + (index + 1)}`;
    eventBus.publish('log/info', store.getUseColors() ? chalk.blueBright(listenLine) : listenLine);
  });

  await Promise.all(proxies.map(({miner}) => miner.start()));

  if (config.config.runIdleBinPath && singleProxy) {
    const idleProgram = new IdleProgram(config.config.runIdleBinPath, config.config.runIdleKillBinPath);
    proxies[0].miner.subscribe('new-round', () => idleProgram.stop());
    proxies[0].miner.subscribe('all-rounds-finished', () => idleProgram.start());
  }
})();
