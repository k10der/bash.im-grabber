# bash.im-grabber #

It is a console utility to save quotes from [bash.im](http://bash.im) site
to local files.

### Usage ###

Clone this repo and run npm install. After that you can run it by `npm start`.
Quotes will be saved in `./main` and `/abyssbest` folders.
It can take about 15 minutes for the initial quotes saving process, but next app runs should take
much less time, as the latest quote ids, that were saved are stored in `cache.json`, which will be generated
after the first launch.

### TODO ###

Here are things to be implemented:

* Add LICENSE
* Add tests
* Move logic to separate files
* Add configuration file for setting paths to save in, filename templates
* Implement data saving in a db
* Implement data saving via REST call
