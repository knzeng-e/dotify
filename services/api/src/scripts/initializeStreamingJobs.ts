import { initializeStreamingJobs } from '../services/streamingJobs.js';
const directory = process.argv[2];
if (!directory || process.argv.length !== 3) throw new Error('Specify a new empty custody directory; never use this to repair lost state');
await initializeStreamingJobs(directory);
console.log('Fresh streaming custody initialized; preserve this directory and all future nonce reservations.');
