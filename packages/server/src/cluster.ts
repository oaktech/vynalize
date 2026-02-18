import cluster from 'cluster';
import os from 'os';

const WEB_CONCURRENCY = parseInt(process.env.WEB_CONCURRENCY || '', 10) || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} forking ${WEB_CONCURRENCY} workers`);

  for (let i = 0; i < WEB_CONCURRENCY; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[cluster] Worker ${worker.process.pid} died (code=${code}, signal=${signal}). Restarting...`);
    cluster.fork();
  });
} else {
  // Workers run the regular server
  import('./index.js');
}
