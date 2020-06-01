const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const crypto = require('crypto');

const axios = require('axios');
const makeDir = require('make-dir');
const get = require('lodash.get');
const debug = require('debug')('jason:load:http');

const REGEX_ABSOLUTE_LINK = /^https?:\/\//;

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

/**
 * Requests data via HTTP. Depends on the "axios" package.
 * @see https://github.com/mzabriskie/axios
 */
class HttpClient {
  /**
   * @param {Object} config The config object
   * @param {*} config.*
   * Keys prefixed with "_" will be used for the loader's own configuration.
   * Other keys will be used as axios options.
   * @param {number} [config._concurrency=1] The concurrency limit when following links and/or
   * paginating.
   */
  constructor({ config = {} } = {}) {
    this._httpConfig = {};
    this._config = {};

    Object.entries(config).forEach(([key, value]) => {
      if (key[0] !== '_') {
        this._httpConfig[key] = value;
      } else {
        this._config[key.slice(1)] = value;
      }
    });

    this._httpClient = axios.create();

    debug('HttpClient instance created.');
    debug('HTTP config', this._httpConfig);

    this._config = { concurrency: 1, ...this._config };
    this._config.concurrency = Number(this._config.concurrency); // just in case

    if (this._config.cache) {
      const cacheConfig = this._config.cache;

      Object.entries(cacheConfig).forEach(([key, value]) => {
        cacheConfig[key.slice(1)] = value;
        delete cacheConfig[key];
      });

      this._setupCache();
    }

    debug('config', this._config);

    this._runs = 0;
  }

  _setupCache() {
    const folderPath = path.join(process.cwd(), this._config.cache.folder);
    debug('Creating folder "%s"...', folderPath);
    makeDir.sync(folderPath);

    const originalRequest = this._httpClient.request.bind(this._httpClient);

    this._httpClient.request = async (args) => {
      const hash = crypto.createHash('sha256');
      const cacheKey = hash.update(JSON.stringify(args)).digest('hex');
      const cacheFile = path.join(folderPath, cacheKey);

      try {
        if (this._config.cache.refresh) {
          throw new Error('Force cache refresh!');
        }

        const response = await readFileAsync(cacheFile);
        debug('Response from cache file "%s".', cacheKey);

        return JSON.parse(response);
      } catch (readError) {
        debug('Creating cache file... Reason ->', readError.toString());

        const response = await originalRequest(args);

        try {
          const cachedResponse = {
            config: response.config,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
          };

          await writeFileAsync(cacheFile, JSON.stringify(cachedResponse));
          debug('Cache file "%s" created.', cacheKey);
        } catch (writeError) {
          debug('Error creating cache file "%s"!', cacheKey, args, writeError.toString());
        }

        return response;
      }
    };

    debug('Cache set up at folder "%s".', folderPath);
  }

  /**
   * Returns the config. Used for limiting the concurrency when following/paginating.
   * @return {Object}
   */
  getConfig() {
    return this._config;
  }

  /**
   * Builds new load options.
   * @param {string} link
   * @return {Object}
   */
  buildLoadOptions({ link }) {
    const options = {};

    if (link.match(REGEX_ABSOLUTE_LINK)) {
      options.baseURL = link;
      options.url = '';
    } else {
      options.baseURL = this._httpConfig.baseURL;
      options.url = link;
    }

    return options;
  }

  /**
   * @param {Object} [options] Optional HTTP options.
   * @return {Promise}
   */
  async run({ options } = {}) {
    const httpConfig = { ...this._httpConfig, ...options };
    this._runs += 1;

    debug('Run #%s...', this._runs);

    const start = this._logRequest(httpConfig);

    try {
      const response = await this._httpClient.request(httpConfig);

      this._logResponse(response, start);

      return response.data;
    } catch (requestError) {
      if (requestError.response) {
        this._logResponse(requestError.response, start);
      } else {
        debug(requestError.toString());
      }

      throw requestError;
    }
  }

  /**
   * @param  {Object} request
   * @return  {number}
   */
  // eslint-disable-next-line class-methods-use-this
  _logRequest(request) {
    const {
      method = 'get',
      baseURL = '',
      url = '',
      params = '',
      headers,
    } = request;

    debug('%s %s%s...', method.toUpperCase(), baseURL, url, params);
    debug(headers);

    return Date.now();
  }

  /**
   * @param  {Object} response
   * @param  {number} start
   */
  // eslint-disable-next-line class-methods-use-this
  _logResponse(response, start) {
    const elapsed = Date.now() - start;

    const {
      config,
      status,
      statusText,
      headers,
    } = response;

    const { method = 'get', url, params = '' } = config;
    const contentLength = get(headers, 'content-length') || get(response, 'data.length') || '?';

    debug('%s %s: %s (%d)', method.toUpperCase(), url, statusText, status, params);
    debug('%dms -> %s chars of "%s".', elapsed, contentLength, headers['content-type']);
  }
}

module.exports = HttpClient;
