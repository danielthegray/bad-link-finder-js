# bad-link-finder-full

This a project with the same intent as my `bad-link-finder` project
(found at https://github.com/thedanielgray/bad-link-finder).

The difference is that `bad-link-finder` simply parses the raw HTML
of a site, which I find not good enough for the usage that I had in
mind. I could have extended it by embedding a Javascript interpreter
or something along those lines, but I preferred to just use a headless
browser and save time.

This project is the result of that idea.

I have tested it on Node.js version 9.11.1.

## Instructions to use

FIRST OF ALL, **ensure that node.js is installed in your environment!**
_(I recommend you use `nvm`, which will allow you to flexibly change from
one version of node.js to another)_.

1. Run `npm install` (feel free to delete all the `node_modules` folder and
   re-run this command if you have any issues).
2. Download the web driver for the browser that you want to use. I have
   decided to use Mozilla Firefox. Drivers for it can be found at:
   https://github.com/mozilla/geckodriver/releases/.
3. Put the webdriver of your choice into your PATH.
4. 
