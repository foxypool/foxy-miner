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
