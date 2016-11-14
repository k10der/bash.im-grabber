'use strict';
/**
 * @description
 * Utility to save quotes from bash.im site
 */

const fs = require('fs');
const path = require('path');

const async = require('async');
const cheerio = require('cheerio');
const iconv = new require('iconv').Iconv('cp1251', 'utf-8');
const moment = require('moment');
const request = require('request');

// Path for quotes on main page
const MAIN_PATH = 'http://bash.im/index';
// Path for save quotes on main page
const MAIN_FILE_PATH = './main';
// Path for quotes on abyss best page
const ABYSS_BEST_PATH = 'http://bash.im/abyssbest';
// Path for save quotes on abyss best page
const ABYSS_BEST_FILE_PATH = './abyssbest';
// Path to file with cached data
const CACHE_FILE_PATH = './cache.json';

// Cache hold main cite id and abyss best date and id
let cache = {
  mainQuoteId: '0',
  abyssBestQuoteId: '#0',
};
// Counter object holds the number of quotes,
// that were saved during the current session
let counter = {
  main: 0,
  abyssBest: 0,
};

/**
 * @description
 * Function to process page quotes
 *
 * @param page {String} - String representation of a page with quotes
 * @return {Object[]}
 */
function processPageQuotes(page) {
  // Initializing an array to hold processed quotes
  let processedQuotes = [];
  // Loading page with cheerio
  let $ = cheerio.load(page);
  // Getting quotes with cheerio
  let quotes = Array.prototype.slice.call($('.quote'));

  // Iterating through quotes
  for (let quote of quotes) {
    // Getting quote id
    let id = $('.id', '.actions', quote).text().replace('#', '');
    // Getting quote approval timestamp
    let ts = $('.date', '.actions', quote).text();
    // Getting quote text
    let text = $('.text', '', quote).text().replace(/<br ?\/?>/gi, '\n');
    // Adding quote data to data array
    processedQuotes.push({id, ts, text});
  }

  // Returning an array of processed quotes
  return processedQuotes;
}

/**
 * @description
 * Function to load page with quotes
 *
 * @param url {String} - Url of page with quotes
 * @param cb {Function} - Callback function
 */
function loadPage(url, cb) {
  request.get(
    {
      uri: url,
      method: 'GET',
      encoding: 'binary'
    },
    function (err, res) {
      // If an error occurred
      if (err) {
        // Stopping further processing
        return cb(err);
      }

      // Getting body's data in utf-8
      let body = iconv.convert(new Buffer(res.body, 'binary')).toString();

      // Returning page body
      cb(null, body);
    });
}

/**
 * @description
 * Main execution function
 */
function index() {
  console.time('Processing time');
  async.waterfall([
    // Loading cache data and parameters
    function _loadCachedData(cb) {
      // Initializing a cache data object
      let _cachedData = {};
      // Trying to find cached data object
      try {
        _cachedData = require(CACHE_FILE_PATH);
      } catch (e) {
      }

      // Returning cache object to the next handler
      cb(null, Object.assign(cache, _cachedData));
    },
    // Processing quotes
    function _processQuotes(cachedData, cb) {
      // Setting new cache data object
      let newCacheData = {
        mainQuoteId: '0',
        abyssBestQuoteId: '#0',
      };

      async.parallel([
        /**
         * @description
         * Function to process quotes from the main page
         *
         * @param cb {Function} - Callback function
         * @private
         */
        function _processMainQuotes(cb) {
          // Setting first time execution flag
          let executedForTheFirstTime = true;
          // Setting max quote id
          let maxQuoteId = '';
          // Setting current page id
          let pageId = null;

          async.whilst(
            /**
             * @description
             * Checking whether processing should occur
             *
             * @return {Boolean}
             * @private
             */
            function _checkMainCondition() {
              // If this is the first time execution or max quote id is greater than required quote id
              return executedForTheFirstTime || (maxQuoteId > cachedData.mainQuoteId && pageId && pageId > 0);
            },
            /**
             * @description
             * Function to process page and save quotes
             *
             * @param cb {Function} - Callback function
             * @private
             */
            function _processPage(cb) {
              // Loading a page
              loadPage(`${MAIN_PATH}/${pageId}`, function (err, page) {
                // If an error occurred
                if (err) {
                  // Stopping further processing
                  return cb(err);
                }

                // Getting quotes
                let quotes = processPageQuotes(page);

                // If quotes array is not empty
                if (quotes.length) {
                  // Setting new main max quote id
                  maxQuoteId = quotes[0].id.toString();
                }
                // Filtering quotes
                quotes = quotes.filter(function (quote) {
                  // Only quotes, that is greater than the main quote id from cache
                  return quote.id > cachedData.mainQuoteId;
                });

                // If we're on the first page
                if (executedForTheFirstTime) {
                  // If quotes array is not empty
                  if (quotes.length) {
                    // Setting new main max quote id
                    newCacheData.mainQuoteId = quotes[0].id.toString();
                  } else {
                    // Setting previous main quote id
                    newCacheData.mainQuoteId = cachedData.mainQuoteId;
                  }
                  // Clearing executed for the first time flag
                  executedForTheFirstTime = false;

                  // Loading page with cheerio
                  let $ = cheerio.load(page);
                  // Getting max page id
                  let id = $('.page', '.pager .current', page).val();

                  // If page id was found
                  if (id) {
                    // Setting new page id
                    pageId = id;
                  }
                }

                // Reducing page id
                pageId--;

                // Asynchronously saving files
                async.eachLimit(quotes, 50, function (q, cb) {
                  // Increasing main counter
                  counter.main++;
                  // Saving a file
                  fs.writeFile(path.join(MAIN_FILE_PATH, `${q.id}@${q.ts}.txt`), q.text, cb);
                }, cb);
              });
            },
            cb
          );
        },
        /**
         * @description
         * Function to process quotes from the abyss best page
         *
         * @param cb {Function} - Callback function
         * @private
         */
        function _processAbyssBestQuotes(cb) {
          // Setting first time execution flag
          let executedForTheFirstTime = true;
          // Setting max quote id
          let maxQuoteId = '';
          // Setting current page date
          let pageDate = moment();
          // Setting minimum page date
          let minimumPageDate = moment().subtract(1, 'year');

          async.whilst(
            /**
             * @description
             * Checking whether processing should occur
             *
             * @return {Boolean}
             * @private
             */
            function _checkMainCondition() {
              // If this is the first time execution or max quote id is greater than required quote id
              return executedForTheFirstTime || (maxQuoteId > cachedData.abyssBestQuoteId && pageDate.diff(minimumPageDate, 'days') >= 0);
            },
            /**
             * @description
             * Function to process page and save quotes
             *
             * @param cb {Function} - Callback function
             * @private
             */
            function _processPage(cb) {
              // Loading a page
              loadPage(`${ABYSS_BEST_PATH}/${pageDate.format('YYYYMMDD')}`, function (err, page) {
                // If an error occurred
                if (err) {
                  // Stopping further processing
                  return cb(err);
                }

                // Getting quotes
                let quotes = processPageQuotes(page);

                // If quotes array is not empty
                if (quotes.length) {
                  // Setting new main max quote id
                  maxQuoteId = quotes[0].id.toString();
                }
                // Filtering quotes
                quotes = quotes.filter(function (quote) {
                  // Only quotes, that is greater than the abyss best quote id from cache
                  return quote.id > cachedData.abyssBestQuoteId;
                });

                // If we're on the first page
                if (executedForTheFirstTime) {
                  // If quotes array is not empty
                  if (quotes.length) {
                    // Setting new main max quote id
                    newCacheData.abyssBestQuoteId = quotes[0].id.toString();
                  } else {
                    // Setting previous main quote id
                    newCacheData.abyssBestQuoteId = cachedData.abyssBestQuoteId;
                  }
                  // Clearing executed for the first time flag
                  executedForTheFirstTime = false;
                }

                // Reducing page date
                pageDate.subtract(1, 'day');

                // Asynchronously saving files
                async.eachLimit(quotes, 50, function (q, cb) {
                  // Increasing abyss best counter
                  counter.abyssBest++;
                  // Saving a file
                  fs.writeFile(path.join(ABYSS_BEST_FILE_PATH, `${q.id}@${q.ts}.txt`), q.text, cb);
                }, cb);
              });
            },
            cb
          );
        },
      ], function (err) {
        // If an error occurred
        if (err) {
          // Stopping further processing
          return cb(err, null);
        }

        // Returning new cache data
        cb(null, newCacheData);
      });
    },
    /**
     * @description
     * Function to save cache parameters
     *
     * @param newCachedData {Object} - Object with new cache info
     * @param cb {Function} - Callback function
     * @private
     */
      function _saveCachedData(newCachedData, cb) {
      fs.writeFile(CACHE_FILE_PATH, JSON.stringify(newCachedData), cb);

    },
  ], function (err) {
    // If an error occurred
    if (err) {
      console.log('Unexpected error has occurred.', err);
      // Stopping further processing
      return;
    }

    console.log(`All quotes were processed. Saved ${counter.main} quotes from the main page and ${counter.abyssBest} quotes from the abyss best page.`);
    console.timeEnd('Processing time');
  });
}

index();
