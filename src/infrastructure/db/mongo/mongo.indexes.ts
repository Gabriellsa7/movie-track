import mongoose from 'mongoose';
import { Logger } from 'traceability';

// Mongoose only creates indexes, so one removed from a schema stays in the database.
// A leftover unique index (like the old users "id_1") rejects every new document.
export async function syncMongoIndexes(): Promise<void> {
  const result = await mongoose.syncIndexes();
  Object.entries(result)
    .filter(([, droppedIndexes]) => droppedIndexes.length > 0)
    .forEach(([modelName, droppedIndexes]) => {
      Logger.warn('Dropped indexes missing from the schema', {
        eventName: 'database.indexes_dropped',
        model: modelName,
        indexes: [...droppedIndexes],
      });
    });
  Logger.info('Database indexes synced', {
    eventName: 'database.indexes_synced',
  });
}
