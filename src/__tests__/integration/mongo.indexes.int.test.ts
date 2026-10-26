import { Logger } from 'traceability';
import '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { syncMongoIndexes } from '../../infrastructure/db/mongo/mongo.indexes';

const indexNames = async (): Promise<string[]> =>
  (await Muser.collection.indexes()).map((index) => index.name!);

describe('When the database has an index that is no longer in the schema', () => {
  it('should drop it, keep the schema indexes and log the dropped one', async () => {
    // Not unique: other suites leave users behind, and they would all collide on id: null.
    await Muser.createCollection();
    await Muser.collection.createIndex({ id: 1 });
    const warnSpy = jest
      .spyOn(Logger, 'warn')
      .mockImplementation(() => Logger);

    await syncMongoIndexes();

    const indexes = await indexNames();
    expect(indexes).not.toContain('id_1');
    expect(indexes).toEqual(expect.arrayContaining(['_id_', 'email_1']));
    expect(warnSpy).toHaveBeenCalledWith(
      'Dropped indexes missing from the schema',
      expect.objectContaining({
        eventName: 'database.indexes_dropped',
        model: Muser.modelName,
        indexes: ['id_1'],
      }),
    );
    warnSpy.mockRestore();
  });
});

describe('When the database indexes already match the schemas', () => {
  it('should not drop anything', async () => {
    await syncMongoIndexes();
    const warnSpy = jest
      .spyOn(Logger, 'warn')
      .mockImplementation(() => Logger);

    await syncMongoIndexes();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
