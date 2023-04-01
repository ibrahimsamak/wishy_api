module.exports = {
  apps : [{
    name   : "shoala",
    script : "./index.js",
    exec_mode : "cluster",
    instances: 4,
    watch: true,
    max_memory_restart: '700M',
    exp_backoff_restart_delay: 150,
  }]
}
