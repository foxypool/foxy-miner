const YAML = require('js-yaml');
const { isEqual } = require('lodash')

class ScavengerConfigGenerator {
  constructor({ config }) {
    this.config = config;
  }

  generate({ minerConfig, minerIndex = null }) {
    let url = `http://${this.config.listenAddr}`;
    if (minerIndex !== null) {
      url += `/${minerIndex + 1}`;
    }
    const plotDirs = this.getFromMinerConfig(minerConfig, { key: 'plotDirs', defaultValue: [] });
    const isCpuOnly = this.getFromConfig(minerConfig, { key: 'isCpuOnly', defaultValue: true });

    const generatedConfig = {
      plot_dirs: plotDirs,
      url,
      hdd_reader_thread_count: 0,
      hdd_use_direct_io: this.getFromMinerConfig(minerConfig, { key: 'useHddDirectIo', defaultValue: true }),
      hdd_wakeup_after: 240,

      cpu_threads: 0,
      cpu_worker_task_count: this.getFromMinerConfig(minerConfig, { key: 'cpuWorkers', defaultValue: isCpuOnly ? 4 : 0 }),
      cpu_nonces_per_cache: 65536,
      cpu_thread_pinning: this.getFromMinerConfig(minerConfig, { key: 'useCpuThreadPinning', defaultValue: false }),

      gpu_platform: this.getFromMinerConfig(minerConfig, { key: 'gpuPlatform', defaultValue: 0 }),
      gpu_device: this.getFromMinerConfig(minerConfig, { key: 'gpuDevice', defaultValue: 0 }),
      gpu_threads: this.getFromMinerConfig(minerConfig, { key: 'gpuThreads', defaultValue: isCpuOnly ? 0 : 1 }),
      gpu_worker_task_count: this.getFromMinerConfig(minerConfig, { key: 'gpuWorkers', defaultValue: isCpuOnly ? 0 : 12 }),
      gpu_nonces_per_cache: this.getFromMinerConfig(minerConfig, { key: 'gpuNoncesPerCache', defaultValue: 262144 }),

      gpu_mem_mapping: this.getFromMinerConfig(minerConfig, { key: 'useGpuMemMapping', defaultValue: false }),
      gpu_async: this.getFromMinerConfig(minerConfig, { key: 'useGpuAsyncCompute', defaultValue: !isCpuOnly }),

      target_deadline: this.getFromConfig(minerConfig, { key: 'targetDL', defaultValue: 31536000 }),
      get_mining_info_interval: 500,
      timeout: 5000,
      send_proxy_details: true,

      console_log_level: 'info',
      logfile_log_level: 'off',
      logfile_max_count: 10,
      logfile_max_size: 20,
      console_log_pattern: '{({d(%H:%M:%S)} [{l}]):16.16} {m}{n}',
      logfile_log_pattern: '{({d(%Y-%m-%d %H:%M:%S)} [{l}]):26.26} {m}{n}',

      show_progress: true,
      show_drive_stats: false,
      benchmark_only: 'disabled',
    };

    return YAML.dump(generatedConfig, { lineWidth: 140 });
  }

  updateConfig({ configYaml, minerConfig, minerIndex = null }) {
    const config = YAML.load(configYaml);
    let url = `http://${this.config.listenAddr}`;
    if (minerIndex !== null) {
      url += `/${minerIndex + 1}`;
    }
    if (config.url !== url) {
      config.url = url;
    }
    const plotDirs = this.getFromMinerConfig(minerConfig, { key: 'plotDirs', defaultValue: null });
    if (plotDirs !== null && !isEqual(config.plot_dirs.sort(), plotDirs.sort())) {
      config.plot_dirs = plotDirs;
    }
    if (plotDirs !== null && config.hdd_reader_thread_count !== 0) {
      config.hdd_reader_thread_count = 0;
    }
    const useDirectIo = this.getFromMinerConfig(minerConfig, { key: 'useHddDirectIo', defaultValue: null });
    if (useDirectIo !== null && config.hdd_use_direct_io !== useDirectIo) {
      config.hdd_use_direct_io = useDirectIo;
    }
    const cpuWorkers = this.getFromMinerConfig(minerConfig, { key: 'cpuWorkers', defaultValue: null });
    if (cpuWorkers !== null && config.cpu_worker_task_count !== cpuWorkers) {
      config.cpu_worker_task_count = cpuWorkers;
    }
    const useCpuThreadPinning = this.getFromMinerConfig(minerConfig, { key: 'useCpuThreadPinning', defaultValue: null });
    if (useCpuThreadPinning !== null && config.cpu_thread_pinning !== useCpuThreadPinning) {
      config.cpu_thread_pinning = useCpuThreadPinning;
    }
    const gpuPlatform = this.getFromMinerConfig(minerConfig, { key: 'gpuPlatform', defaultValue: null });
    if (gpuPlatform !== null && config.gpu_platform !== gpuPlatform) {
      config.gpu_platform = gpuPlatform;
    }
    const gpuDevice = this.getFromMinerConfig(minerConfig, { key: 'gpuDevice', defaultValue: null });
    if (gpuDevice !== null && config.gpu_device !== gpuDevice) {
      config.gpu_device = gpuDevice;
    }
    const gpuThreads = this.getFromMinerConfig(minerConfig, { key: 'gpuThreads', defaultValue: null });
    if (gpuThreads !== null && config.gpu_threads !== gpuThreads) {
      config.gpu_threads = gpuThreads;
    }
    const gpuWorkers = this.getFromMinerConfig(minerConfig, { key: 'gpuWorkers', defaultValue: null });
    if (gpuWorkers !== null && config.gpu_worker_task_count !== gpuWorkers) {
      config.gpu_worker_task_count = gpuWorkers;
    }
    const gpuNoncesPerCache = this.getFromMinerConfig(minerConfig, { key: 'gpuNoncesPerCache', defaultValue: null });
    if (gpuNoncesPerCache !== null && config.gpu_nonces_per_cache !== gpuNoncesPerCache) {
      config.gpu_nonces_per_cache = gpuNoncesPerCache;
    }
    const useGpuMemMapping = this.getFromMinerConfig(minerConfig, { key: 'useGpuMemMapping', defaultValue: null });
    if (useGpuMemMapping !== null && config.gpu_mem_mapping !== useGpuMemMapping) {
      config.gpu_mem_mapping = useGpuMemMapping;
    }
    const useGpuAsyncCompute = this.getFromMinerConfig(minerConfig, { key: 'useGpuAsyncCompute', defaultValue: null });
    if (useGpuAsyncCompute !== null && config.gpu_async !== useGpuAsyncCompute) {
      config.gpu_async = useGpuAsyncCompute;
    }
    const targetDL = this.getFromConfig(minerConfig, { key: 'targetDL', defaultValue: null });
    if (targetDL !== null && config.target_deadline !== targetDL) {
      config.target_deadline = targetDL;
    }

    return YAML.dump(config, { lineWidth: 140 });
  }

  getFromMinerConfig(minerConfig, { key, defaultValue = null }) {
    if (minerConfig.minerConfig && minerConfig.minerConfig[key] !== undefined) {
      return minerConfig.minerConfig[key];
    }
    if (this.config.minerConfig && this.config.minerConfig[key] !== undefined) {
      return this.config.minerConfig[key];
    }

    return defaultValue;
  }

  getFromConfig(minerConfig, { key, defaultValue = null }) {
    if (minerConfig && minerConfig[key] !== undefined) {
      return minerConfig[key];
    }
    if (this.config && this.config[key] !== undefined) {
      return this.config[key];
    }

    return defaultValue;
  }
}

module.exports = ScavengerConfigGenerator;
