'use strict';
var mod_getopt = require('posix-getopt');
var webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until;
var firefox = require('selenium-webdriver/firefox');
var http = require('http');
var https = require('https');
var binary = new firefox.Binary(firefox.Channel.RELEASE);
binary.addArguments("-headless");
var driver = new webdriver.Builder()
    .forBrowser('firefox')
	.setFirefoxOptions(new firefox.Options().setBinary(binary))
    .build()

var option;
var crawl_depth = -1;
var domain = "";
var verbose = 0;

var parser = new mod_getopt.BasicParser('c:(crawl-depth)d:(domain)v(verbose)',
	process.argv);
while ((option = parser.getopt()) !== undefined) {
	switch (option.option) {
	case 'c':
		crawl_depth = option.optarg;
		break;
	case 'd':
		domain = option.optarg;
		break;
	case 'v':
		verbose++;
		break;
	default:
		/* error message already emitted by getopt */
		mod_assert.equal('?', option.option);
		break;
	}
}
var url = process.argv[process.argv.length-1];
if (!url.match(/https?\:\/\//)) {
	url = 'http://'+url;
}
if (!url.match(/.*\/$/)) {
	url += '/';
}
console.log('Crawling URL '+url);
console.log('Restricting the crawling to domain "'+domain+'"');
console.log('Restricting the crawling to links at depth '+crawl_depth);

const url_regex = /(https?:\/\/)?([a-zA-Z0-9.-]+)(:[0-9]+)?(\/.*)/;
function domain_from_url(url) {
	return url.replace(url_regex, "$2");
}

function path_from_url(url) {
	return url.replace(url_regex, "$4");
}

function protocol_from_url(url) {
	return url.replace(/((https?):\/\/)?.*/, "$2");
}

async function check_url_status(url) {
	return new Promise(function(resolve, reject) {
		//console.log("DOMAIN='"+domain_from_url(url)+"' PATH='"+path_from_url(url)+"'");
		var request_options = {
			host: domain_from_url(url),
			path: path_from_url(url),
			headers: {
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			}
		};
		if (url.indexOf('https') === 0) {
			https.get(request_options, function(resp) {
				resolve(resp.statusCode);
			});
		} else {
			http.get(request_options, function(resp) {
				resolve(resp.statusCode);
			});
		}
	});
}

function print_url_status(url, status_code, parent_url, verbose=0) {
	var html_code_group = Math.floor(status_code / 100);
	if (html_code_group != 2 && html_code_group != 3) {
		console.log(url+' (found on '+parent_url
			+' [BROKEN! - '+status_code+']');
	} else if (verbose > 0) {
		console.log(url+' [OK - '+status_code+']');
	}
}

async function crawl_url(url) {
	var url_stack = [];
	var checked_links = {};
	url_stack.push({'url': url, 'depth': 0});
	while (url_stack.length > 0) {
		var url_and_depth = url_stack.pop();
		var current_url = url_and_depth.url;
		var current_depth = url_and_depth.depth;
		var current_parent_url = url_and_depth.parent_url;
		if (crawl_depth != -1 && current_depth > crawl_depth) {
			continue;
		}
		if (checked_links[current_url]) {
			continue;
		}

		checked_links[current_url] = true;
		var url_status = await check_url_status(current_url);
		print_url_status(current_url, url_status, current_parent_url, verbose);

		// if we are restricting crawling to a domain, after checking the
		// external link, we don't add children from that link
		if (domain.length > 0 && !domain_from_url(current_url).match(domain)) {
			continue;
		}

		await driver.get(current_url);

		// Wait for the document to be ready
		var ready_state = await driver.executeScript(
			'return document.readyState;');
		while (ready_state !== 'complete') {
			driver.sleep(500);
			ready_state = await driver.executeScript(
				'return document.readyState;');
		}

		var jquery_on_page = await driver.executeScript(
			'return typeof jQuery !== "undefined";');
		if (jquery_on_page) {
			// also wait for jQuery loading to finish (ajax requests, etc.)
			var jquery_active = await driver.executeScript(
				'return jQuery.active;');
			while (jquery_active !== 0) {
				driver.sleep(500);
				jquery_active = await driver.executeScript(
					'return jQuery.active;');
			}
		}

		var actual_url = await driver.getCurrentUrl();
		if (actual_url !== current_url) {
			var actual_url_status = await check_url_status(actual_url);
			print_url_status(actual_url, actual_url_status,
				current_parent_url, verbose);
			checked_links[actual_url] = true;
		}

		var link_objects = await driver.findElements(By.tagName('a'));
		for (var link_object of link_objects) {
			var link_href = await link_object.getAttribute('href');
			if (link_href == null
					|| link_href.match(/^mailto:/)
					|| link_href.match(/^news:/)
					|| checked_links[link_href]) {
				continue;
			}
			url_stack.push({
				url: link_href,
				depth: current_depth+1,
				parent_url: current_url
			});
		}
	}
}
crawl_url(url).then(function() {
	driver.quit();
}).catch((ex) => function() {
	driver.quit();
});
