const StdinReader = require('./StdinReader');
const HttpClient = require('./HttpClient');
const FileReader = require('./FileReader');
const CsvFileLoader = require('./CsvFileLoader');
const IdentityProcessor = require('../IdentityProcessor');
const NoOperationProcessor = require('../NoOperationProcessor');

/**
 * Loaders.
 * The property names can be used to configure the scraping process.
 * @type {Object}
 */
module.exports = {
  stdin: StdinReader,
  http: HttpClient,
  file: FileReader,
  'csv-file': CsvFileLoader,
  identity: IdentityProcessor,
  noop: NoOperationProcessor,
};
