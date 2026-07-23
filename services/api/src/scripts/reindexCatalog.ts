import { catalogReadModel } from '../services/catalog/index.js';

try {
  const snapshot = await catalogReadModel.sync({ forceReindex: true });
  console.log(`Catalog reindexed at block ${snapshot.lastIndexedBlock}: ${snapshot.artists.length} artists, ${snapshot.releases.length} releases.`);
} finally {
  catalogReadModel.stop();
}
