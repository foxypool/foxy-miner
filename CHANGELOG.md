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
