2.7.0 / 2023-06-18
==================

* Drop BHD as it transitions to CHIA plots.

2.6.0 / 2022-02-05
==================

* Update managed scavenger installs to 1.9.0
* Fix multi managed miner bootstrapping

2.5.0 / 2022-02-05
==================

* Require at least node 14
* Update dependencies
* Remove bitmart and coinpaprika api

2.4.1 / 2021-07-27
==================

* Fix the shown DL and NetDiff values for SIGNA.

2.4.0 / 2021-07-18
==================

* Use SIGNA throughout instead of BURST
* Drop HDD, LHD and XHD from the first run wizard

2.3.0 / 2021-06-23
==================

* Update socket.io to v4 and enforce websocket transports
* Add config option `allowLongPolling` to allow the use of long polling as socket.io transport
* Fix missing config validation for `minerBinPath` in unmanaged mode

2.2.0 / 2021-04-02
==================

* Automatically fix all sorts of invalid and broken scavenger configs
* Set `useGpuMemMapping` and `useGpuAsyncCompute` based on the detected gpu
* The native module is now included in the binary, no more extra files
* Fix invalid log message when loading the config from a custom location

2.1.0 / 2021-03-11
==================

* Automatically fix invalid `plotDirs` and `listenAddr` config values

2.0.1 / 2021-03-09
==================

* Fix a bug that could cause the miner to crash on startup on certain systems

2.0.0 / 2021-03-06
==================

* Foxy-Miner will now manage scavenger binaries and configs itself, all config is done through the Foxy-Miner config. This applies to new configs created by the first run wizard only. Existing configs will continue to function and are not migrated
* The Foxy-Miner config file is now stored in the home directory of the user, eg: `C:\Users\<User>\.config\foxy-miner\foxy-miner.yaml`. If this file does not exist Foxy-Miner will search for the config file in the current directory
* Auto-detect plot files in first run wizard
* Auto-detect GPU availability in first run wizard and adjust `gpuWorkers` based on found plot files and max memory of the GPU
* Auto-detect CPU cores and set `cpuWorkers` based on found plot files and max cores of the CPU when no GPU is found
* Bundle the required native module for gpu detection with the release binary in a versioned release zip archive instead of plain binaries
* Add support for logging to file via a `logToFile` option
* Fix miner scan progress output glitches

1.20.0 / 2020-10-29
==================

* Remove `listenAddress` from first run wizard
* Include the upstream name in scan start log lines
* Update dependencies

1.19.0 / 2020-08-30
==================

* Add support for listening on an ipv6 address

1.18.0 / 2020-08-08
==================

* Use fixed indexes for multi miner setups. This means if you run a multi miner setup and have one miner disabled the other miners endpoints are still counted as if it were enabled, the index is just skipped. This can be a breaking change, please adjust your miner config accordingly.
* Add support for auto-downloading a Mac OS X compiled scavenger 1.7.8 binary
* Remove DISC from the first run wizard as well as the profitability service
* Use the foxypool.io domain

1.17.0 / 2020-07-26
==================

* Add support for showing SODIUM deadlines and netDiff (@zyzzyva99)
* Drop BOOM and LAVA from profitability calculations
* Remove AETH and BTB Foxy-Pools from First Run Wizard
* Fix obscure connection issues with the miner-gateway and websocket transports

1.16.1 / 2020-04-06
==================

* Remove LAVA from first run wizard

1.16.0 / 2020-04-04
==================

* Add auto download and configuration of scavenger in first run wizard

1.15.1 / 2020-04-03
==================

* Fix: Only connect to the gateway if no url set

1.15.0 / 2020-04-03
==================

* Add support for single connection foxy-pool upstreams which do not require an url to be configured

1.14.2 / 2020-04-01
==================

* Use new mining endpoints for config generation

1.14.1 / 2020-03-25
==================

* Fix `assumeScannedAfter` marking unfinished rounds as finished

1.14.0 / 2020-03-22
==================

* Rename the default config file to foxy-miner.yaml
* Add AETH to pool list for setup wizard
* Listen on /1 for single miner setups as well
* Fix `assumeScannedAfter` option
* Fix old rounds of unused upstreams never getting removed if they were never fully scanned
* Fix configured weight not favored over profitability based weight in some cases

1.13.0 / 2020-01-15
==================

* Add support for nodejs v12.
* Favor configured weight over profitability based weight.
* Add `minWeight` config option to only mine coins above a minimum weight.
* Add support for halting BTB mining when supplying a BTB `walletUrl` and the plotterId is over capacity.

1.12.1 / 2019-11-30
==================

* Fix `minerConfigPath` for single miner configs.

1.12.0 / 2019-11-22
==================

* Add `allowMiningToBeHalted` upstream config option for foxy-pools.
* Add XHD and BTB pools to setup wizard.
* Fix multi miner bestDL aggregation for live dashboard.
* Fix `submitProbability` for greater 100%

1.11.0 / 2019-10-17
==================

* Allow setting distributionRatio via a config option for foxy-pools.
* Add LAVA pool to setup wizard.
* Fix interruption for same upstream when using `doNotInterruptAbovePercent`.
* Fix netDiff for BHD.

1.10.0 / 2019-10-07
==================

* Remove pool DR selection in first install wizard as the pool handles that now.
* Drop hdpool support.
* Add support for HDD.
* Auto remove trailing slash in foxypool url if detected.
* Fix BHD rate for profitability based switching.
* Fix dynamic TargetDL for LHD.
* Fix error when no speed information can be found in the miners output.

1.9.0 / 2019-09-07
==================

* Add support for LHD mining on hdpool.
* Fix "new" backwards incompatible mining api of hdpool.

1.8.0 / 2019-09-05
==================

* Add `doNotInterruptAbovePercent` upstream option.
* Add `hideScanProgress` config option.

1.7.1 / 2019-09-05
==================

* Fix missing scan progress.

1.7.0 / 2019-09-05
==================

* Add config switch to toggle full/eco block rewards for profitability calculation.
* Add DISC and LHD profitability data.
* Add submit probability.
* Adapt profitability calculation to use new BHD block rewards.
* Use LHD genesis base target for netDiff calculation.
* Add cli-dashboard for live stats.
* Add support for multiple scav/conqueror instances.

1.6.0 / 2019-08-22
==================

* Add LHD to the setup wizard.
* Add targetDL support.
* Show fallback weight in case of no profitability data.

1.5.1 / 2019-08-14
==================

* Fix typo in setup wizard.

1.5.0 / 2019-08-06
==================

* Add setup wizard.
* Add support for `humanizeDeadlines` option.
* Add support for HDPool.
* Add dynamic deadline colors.
* Add support for accountId colors.
* Add support for prebuilt binaries.

1.4.1 / 2019-07-26
==================

* Fix BOOM rate not being updated correctly.
* Rename minerAlias to accountName.

1.4.0 / 2019-07-25
==================

* Add support for BOOM rates.
* Automatically add '/mining' to Foxy-Pool URLs if missing.

1.3.0 / 2019-07-15
==================

* Add support for `assumeScannedAfter` to force chain switches.
* Add support for `maxNumberOfChains`.
* Add support for connection outage detection.
* Add experimental support for running a program when idling.
* Fix unicode minerAlias in header when using http upstreams.

1.2.0 / 2019-07-02
==================

* Add support for dynamic prio's based on profitability.
* Add support for disabling upstreams.
* Fix possibly outdated miningInfo after reconnecting through socket.io.
* Rename prio to weight in config to clarify precedence.

1.1.0 / 2019-06-30
==================

* Add support for conqueror.
* Add support for custom miner colors in Foxy-Proxy.
* Fix starting the miner on linux.

1.0.0 / 2019-06-04
==================

* Initial release.
