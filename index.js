import { Mongo } from 'meteor/mongo';
import { Random } from 'meteor/random';
import sinon from 'sinon';

const StubCollections = (() => {
  const publicApi = {};
  const privateApi = {};

  /* Public API */

  publicApi.add = (collections) => {
    privateApi.collections = privateApi.collections.concat(collections);
  };

  publicApi.stub = (collections) => {
    const pendingCollections = collections || privateApi.collections;
    [].concat(pendingCollections).forEach((collection) => {
      if (!privateApi.pairs.has(collection)) {
        const options = {
          connection: null,
          transform: collection._transform,
        };
        const localCollection = new collection.constructor(collection._name, options);
        privateApi.stubPair({ localCollection, collection });
        privateApi.pairs.set(collection, localCollection);
      }
    });
  };

  publicApi.restore = () => {
    // Pre-emptively remove the documents from the local collection because if
    // a collection with the same name is stubbed later it will still have the
    // documents from LocalConnectionDriver's internal cache.
    for (const localCollection of privateApi.pairs.values()) {
      localCollection.remove({});
    }
    privateApi.sandbox.restore();
    privateApi.pairs.clear();
  };

  /* Private API */

  privateApi.sandbox = sinon.createSandbox();
  privateApi.pairs = new Map();
  privateApi.collections = [];

  // Retrieve all property names to stub. Can't use _.allKeys, as it is not available in
  // Underscore 1.5.2, and _.keys will not return all properties when using some common
  // packages extending collections.
  privateApi.symbols = [];
  for (let symbol in Mongo.Collection.prototype) {
    privateApi.symbols.push(symbol);
  }

  privateApi.assignLocalFunctionsToReal = (local, real) => {
    privateApi.symbols.forEach((symbol) => {
      if (symbol === 'simpleSchema') return;
      if (typeof local[symbol] !== 'function') return;
      if (typeof real[symbol] !== 'function') return;
      privateApi.sandbox.stub(real, symbol).callsFake(
        local[symbol].bind(local),
      );
    });
  };

  privateApi.stubPair = (pair) => {
    privateApi.assignLocalFunctionsToReal(
      pair.localCollection,
      pair.collection,
    );
    // If using `matb33:collection-hooks`, make sure direct functions are also
    // stubbed.
    if (pair.collection.direct) {
      privateApi.assignLocalFunctionsToReal(
        pair.localCollection,
        pair.collection.direct,
      );
    }
  };

  return publicApi;
})();

export default StubCollections;
