const YAML = require('js-yaml');

class ScavengerConfigGenerator {
  constructor({ config }) {
    this.config = config;
  }

  generate({ minerConfig, minerIndex = null }) {
    let url = `http://${this.config.listenAddr}`;
    if (minerIndex !== null) {
      url += `/${minerIndex + 1}`;
    }
    const plotDirs = this.get(minerConfig, { key: 'plotDirs', defaultValue: [] });
    const isCpuOnly = this.get(minerConfig, { key: 'isCpuOnly', defaultValue: true });

    const generatedConfig = {
      plot_dirs: plotDirs,
      url,
      hdd_reader_thread_count: plotDirs.length,
      hdd_use_direct_io: this.get(minerConfig, { key: 'useHddDirectIo', defaultValue: true }),
      hdd_wakeup_after: 240,

      cpu_threads: 0,
      cpu_worker_task_count: this.get(minerConfig, { key: 'cpuWorkers', defaultValue: isCpuOnly ? 4 : 0 }),
      cpu_nonces_per_cache: 65536,
      cpu_thread_pinning: this.get(minerConfig, { key: 'useCpuThreadPinning', defaultValue: false }),

      gpu_platform: this.get(minerConfig, { key: 'gpuPlatform', defaultValue: 0 }),
      gpu_device: this.get(minerConfig, { key: 'gpuDevice', defaultValue: 0 }),
      gpu_threads: this.get(minerConfig, { key: 'gpuThreads', defaultValue: isCpuOnly ? 0 : 1 }),
      gpu_worker_task_count: this.get(minerConfig, { key: 'gpuWorkers', defaultValue: isCpuOnly ? 0 : 4 }),
      gpu_nonces_per_cache: this.get(minerConfig, { key: 'gpuNoncesPerCache', defaultValue: 262144 }),

      gpu_mem_mapping: this.get(minerConfig, { key: 'useGpuMemMapping', defaultValue: false }),
      gpu_async: this.get(minerConfig, { key: 'useGpuAsyncCompute', defaultValue: false }),

      target_deadline: this.get(minerConfig, { key: 'targetDL', defaultValue: 31536000 }),
      get_mining_info_interval: 500,
      timeout: 5000,
      send_proxy_details: true,

      console_log_level: 'info',
      logfile_log_level: 'warn',
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

  get(minerConfig, { key, defaultValue = null }) {
    if (minerConfig[key] !== undefined) {
      return minerConfig[key];
    }
    if (this.config[key] !== undefined) {
      return this.config[key];
    }

    return defaultValue;
  }
}

module.exports = ScavengerConfigGenerator;
