# bad-link-finder-full

This a project with the same intent as my `bad-link-finder` project
(found at https://github.com/thedanielgray/bad-link-finder).

The difference is that `bad-link-finder` simply parses the raw HTML
of a site, which I find not good enough for the usage that I had in
mind. I could have extended it by embedding a Javascript interpreter
or something along those lines, but I preferred to just use a headless
browser and save time.

This project is the result of that idea.

I have tested it on Node.js version 8.11.1.

## Usage instructions

FIRST OF ALL, **ensure that node.js is installed in your environment!**
_(I recommend you use `nvm`, which will allow you to flexibly change from
one version of node.js to another)_.

1. Run `npm install` (feel free to delete all the `node_modules` folder and
   re-run this command if you have any issues).
2. Download the web driver for the browser that you want to use. I have
   decided to use Mozilla Firefox. Drivers for it can be found at:
   https://github.com/mozilla/geckodriver/releases/.
3. Put the webdriver of your choice into your PATH.
4. Ensure that you have Firefox installed.

With your terminal in the repository folder and with everything set up, run
the following:
`node bad_link_finder.js [COMMAND_LINE_OPTIONS] URL`
The command line options are:
* **`--domain DOMAIN_TO_RESTRICT_CRAWLING_TO` (can also be `-d`):**
	This option will restrict the recursive crawling to URLs under this domain.
	URLs outside of this domain will be checked, but links on the page they
	point to will not be crawled.
* **`--crawl-depth MAX_DEPTH_TO_CRAWL` (can also be `-c`):**
	This option will restrict crawling to URLs up to a certain number of
	"levels" down from the root URL provided (the last command line argument).
* **`--max-retries MAX_RETRIES` can also be `-r`):**
	This option will limit the number of times a URL is retried (if it times
	out). By default, it will retry once. Also note that the URL will not be
	retried immadiately; it will be added to the bottom of the stack to be
	checked after all the other URLs have been checked.
* **`--saved SAVED_CRAWL_SESSION` can also be `-s`):**
	This option will allow you to resume a saved crawl session, by specifying
	the filename of the saved session (stopping the process with Control-C)
	will save the progress out to a file with a random name.
* **`--verbose` (can also be `-v`):**
	This options increases the verbosity, which means that it will also print
	links that return 2xx or 3xx HTTP response codes.

**Example:**
 `node bad_link_finder.js --domain crates.io --crawl-depth 2 -v https://crates.io`
