const { promisify } = require('util');
const csvParse = require('csv-parse');
const debug = require('debug')('jason:parse:csv');

const csvParseAsync = promisify(csvParse);

/**
 * Parses CSV. Depends on the "csv-parse" package.
 * @see https://github.com/adaltas/node-csv-parse
 */
class CsvParser {
  /**
   * @param  {Object} config csv-parse options
   */
  constructor({ config = {} } = {}) {
    this._config = config;
    debug('CsvParser instance created.');
    debug('config', this._config);
  }

  /**
   * Runs the processor: parses the CSV passed as parameter using the current config.
   * @param {string} data
   * @return {Promise.<Object>}
   */
  async run({ data: csv }) {
    debug('Parsing...');
    const start = Date.now();

    const result = await csvParseAsync(csv, this._config);

    const elapsed = Date.now() - start;
    debug('Done parsing %d CSV record(s) in %dms.', result.length, elapsed);

    return {
      result: { csv: result },
      schema: null,
      follows: [],
      paginates: [],
    };
  }
}

module.exports = CsvParser;
