'use strict';
var mod_getopt = require('posix-getopt');
var fs = require('fs');
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
var max_retries=1;
var saved_session_file = null;
var url_stack = [];
var checked_links = {};

var parser = new mod_getopt.BasicParser(
	'c:(crawl-depth)d:(domain)r:(max-retries)s:(saved)v(verbose)',
	process.argv);
while ((option = parser.getopt()) !== undefined) {
	switch (option.option) {
	case 'c':
		crawl_depth = option.optarg;
		break;
	case 'd':
		domain = option.optarg;
		break;
	case 'r':
		max_retries = option.optarg;
		break;
	case 's':
		saved_session_file = option.optarg;
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
if (process.argv.length < 3) {
	process.stderr.write("Missing URL!!\n");
	process.exit();
}
var url = process.argv[process.argv.length-1];
if (!url.match(/https?\:\/\//)) {
	url = 'http://'+url;
}
if (!url.match(/.*\/$/)) {
	url += '/';
}
if (saved_session_file) {
	let saved_session = JSON.parse(fs.readFileSync(saved_session_file));
	console.log(saved_session);
	url = saved_session.url;
	url_stack = saved_session.url_stack,
	checked_links = saved_session.checked_links;
	crawl_depth = saved_session.crawl_depth;
	domain = saved_session.domain;
	verbose = saved_session.verbose;
	max_retries = saved_session.max_retries;
}
console.log('Crawling URL set to: '+url);
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
function randomString(length) {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
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
			}).on('error', function(err) {
				reject(err);
			});
		} else {
			http.get(request_options, function(resp) {
				resolve(resp.statusCode);
			}).on('error', function(err) {
				reject(err);
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

function process_error(error, url_stack, checked_links, url_object) {
	if (error.code === 'ENOTFOUND') {
		console.log(url_object.url+' (found on '+url_object.parent_url
			+' [BROKEN! - cannot resolve "'+error.hostname+'"]');
		return;
	}
	if (url_object.retry_attempt > max_retries) {
		console.log(url_object.url+' (found on '+url_object.parent_url
			+' [BROKEN! - Timed out]');
		return;
	}
	if (error) {
		console.log('UNKNOWN ERROR!!!');
		console.log(error);
	}
	checked_links[current_url] = null;
	// we unshift to put it at the bottom of the stack
	// (to check later)
	url_stack.unshift({
		url: url_object.url,
		depth: url_object.depth,
		parent_url: url_object.parent_url,
		retry_attempt: url_object.retry_attempt + 1
	});
}

async function crawl_url(url) {
	if (url_stack.length == 0) {
		console.log('Starting crawl process at ' + url);
		url_stack.push({'url': url, 'depth': 0});
	}
	console.log('There are '+url_stack.length+' URLs in the stack');
	while (url_stack.length > 0) {
		var url_object = url_stack.pop();
		var current_url = url_object.url;
		var current_depth = url_object.depth;
		var current_parent_url = url_object.parent_url;
		var current_retry_attempt = url_object.retry_attempt;
		if (crawl_depth != -1 && current_depth > crawl_depth) {
			continue;
		}
		if (checked_links[current_url]) {
			continue;
		}

		if (verbose > 1) {
			console.log('Popped '+current_url);
		}

		checked_links[current_url] = true;
		try {
			var url_status = await check_url_status(current_url);
		} catch (error) {
			process_error(error, url_stack, checked_links, url_object);
			continue;
		}
		print_url_status(current_url, url_status, current_parent_url, verbose);

		// if we are restricting crawling to a domain, after checking the
		// external link, we don't add children from that link
		if (domain.length > 0 && !domain_from_url(current_url).match(domain)) {
			continue;
		}

		try {
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
				try {
					var actual_url_status = await check_url_status(actual_url);
				} catch (error) {
					var actual_url_object = Object.assign({}, url_object);
					actual_url_object.url = actual_url;
					process_error(error, url_stack, checked_links, actual_url_object);
					continue;
				}
				print_url_status(actual_url, actual_url_status,
					current_parent_url, verbose);
				checked_links[actual_url] = true;
			}

			var links = await driver.executeScript('var urls=[];for (var i= document.links.length; i-->0;) urls.push(document.links[i].href); return urls;');
			for (var link_href of links) {
				if (link_href == null
						|| link_href.match(/^mailto:/)
						|| link_href.match(/^news:/)
						|| checked_links[link_href]) {
					continue;
				}
				url_stack.push({
					url: link_href,
					depth: current_depth+1,
					parent_url: current_url,
					retry_attempt: 0
				});
			}
		} catch(e) {
			console.log(e);
			throw e;
		}
	}
}

crawl_url(url).then(() => {
	process.stderr.write('FINISHED CRAWLING!!\n');
	driver.quit();
}).catch((ex) => function() {
	process.stderr.write('ERROR WHILE CRAWLING!!\n');
	driver.quit();
});

process.on('SIGINT', function() {
	process.stderr.write('\nCaught Control+C. Saving crawl session...\n');
	// Yes, I know that declarations are hoisted anyway...
	// but it still looks ugly for me if I declared it inside the loop!
	var filename;
	var max_failures=15;
	var num_failures = 0;
	do {
		filename = 'crawling_session_'+randomString(10)+'.crawl';
		num_failures++;
	} while (fs.existsSync(filename) && num_failures < max_failures);
	if (num_failures >= max_failures) {
		process.stderr.write('Was unable to select a suitable filename for saving the session!\n');
		return;
	}

	fs.writeFileSync(filename, JSON.stringify({
		'url_stack': url_stack,
		'checked_links': checked_links,
		'crawl_depth': crawl_depth,
		'domain': domain,
		'verbose': verbose,
		'max_retries': max_retries,
		'url': url
	}), function(err) {
		if (err) {
			process.stderr.write('ERROR while saving session for future crawling!\n');
			console.log(err);
			driver.quit();
			return;
		}
		process.stdout.write('The session file was successfully saved to "'
			+ filename + '"!\n');
		return;
	});
	process.stdout.write('The session file was successfully saved to "'
		+ filename + '"!\n');
});
