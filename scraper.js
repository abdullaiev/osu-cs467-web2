const DEBUGGING = true;

const rp = require('request-promise');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const URL = require('url').URL;


function log(argument) {
    if (DEBUGGING) {
        console.log(argument);
    }
}

//constructor for WebLink object
var WebLink = (function () {
    var counter = 0;

    return function WebLink(url) {
        this.url = url;
        this.webLinks = [];
        this.count = ++counter;

    }
})();

//scraper API
module.exports = {
    crawl: function (qry, serverFunc, websocket) {
        crawl(qry, serverFunc, websocket);
    }
};


function crawl(qry, websocket, serverFunc) {

    if (!qry['url'].startsWith('http')) {
        qry['url'] = "http://" + qry['url'];
    }


    var searchMethod = qry['searchMethod'].toLowerCase();

    if (searchMethod == 'dfs' || 'bfs') {

        var crawlObj = {
            visited: [qry['url']],
            depth: parseInt(qry['size']),
            method: searchMethod,
            queue: new Queue()
        }

        var rootNode = new WebLink(qry['url']);

        crawlObj.queue.enqueue(rootNode);

        crawlHelper(crawlObj, function () {
            serverFunc(rootNode);
        }, websocket);
    }
    else {
        console.log("Invalid searchMethod:" + searchMethod);
    }

}

//sends a base64 encoded jpeg screenshot to client
// https://github.com/checkly/puppeteer-examples/blob/master/1.%20basics/screenshots.js
async function capture(url, ws) {
    try {
        const browser = await puppeteer.launch()
        const page = await browser.newPage()
        await page.setViewport({width: 480, height: 240})
        await page.goto(url)

        var img = await page.screenshot({encoding: 'base64', type: 'jpeg'})

        await browser.close()

        if (ws) {
            var response = {
                code: "image",
                data: img
            };
            await ws.send(JSON.stringify(response));
        }

    }
    catch (err) {
        console.log("\n Screenshot Error: " + err)
    }
}


//performs bfs or dfs crawl
function crawlHelper(crawlObj, callback, websocket) {

    if (crawlObj.depth == crawlObj.visited.length) {
        log("\n\n ==========  server callback  ==========\n\n");

        while (!crawlObj.queue.isEmpty) {  //eliminate further calls
            crawlObj.queue.dequeue();
        }

        callback();
        return;
    }
    else if (crawlObj.depth < crawlObj.visited.length) {    //prevents inf recursion
        return;
    }

    //get node depending on search method
    var node = crawlObj.queue.dequeue();

    //scrape node url for links
    scrape(node.url, function (links, title, favicon) {
        node.title = title;
        node.favicon = favicon;

        //get image of url
        capture(node.url, websocket); 


        //recursively search links
        if (links.length > 0) {

            var index = 0;

            //random index for dfs
            if (crawlObj.method == 'dfs') {
                index = Math.floor(Math.random() * links.length);
                //make sure not visited
                while (links.length > 0 && links[index] in crawlObj.visited) {
                    links.splice(index, 1);
                    index = Math.floor(Math.random() * links.length)
                }
            }

            //loops through links if bfs, else only once on index
            do {
                var link = links[index];

                if (!( link in crawlObj.visited)) {

                    crawlObj.visited.push(link);

                    if (websocket) {
                        //send update to client
                        websocket.send(JSON.stringify({
                            code: 'progressUpdated',
                            data: {
                                // url: link,
                                count: crawlObj.visited.length
                            }
                        }));
                    }

                    //append node with child link node
                    const childNode = new WebLink(link)
                    node.webLinks.push(childNode);

                    crawlObj.queue.enqueue(childNode);

                    crawlHelper(crawlObj, callback, websocket);
                }
                ++index;
            } while (crawlObj.method != 'dfs' && index < links.length);

        }
        else if (crawlObj.method == 'dfs') {
            //TODO: handle dead end 
            //if visited < depth, get next link and search in tree for node, then search
            console.log("No links for " + node.url)

            callback();
            return;
        }
    });
}


//webscraping reference: https://codeburst.io/an-introduction-to-web-scraping-with-node-js-1045b55c63f7
//scrapes url site and performs callback on each link
function scrape(url, callback) {

    log("scraping " + url);

    //options for request
    const options = {
        uri: url,
        transform: function (body) {
            var titleStart = body.indexOf('<title>');
            var titleEnd = body.indexOf('</title>');
            var title = body.substring(titleStart, titleEnd);

            if (title.startsWith("<title>")) {
                title = title.replace("<title>", "");
            } else {
                title = "";
            }

            return {
                $: cheerio.load(body),
                title: title
            };
        },
        resolveWithFullResponse: true
    };

    var links = [];
    var linkMap = {};

    //calls request, executes promise
    rp(options)
        .then((response) => {
            //TODO: implement keyword stop
            var $ = response.$;

            $('a').each(function () {
                var link = $(this).attr('href');
                if (link) {
                    //if link address is self-referenced, insert domain
                    if (link.substring(0, 2) == './') {
                        link = url + link.substring(1);
                    }
                    //add unique link
                    if (link.startsWith('http') && !linkMap[link]) {
                        links.push(link);
                        linkMap[link] = true;
                    }
                }
            });

            var titleText = response.title;

            if (!titleText) {
                titleText = url;
            }

            titleText = titleText.length > 20 ? titleText.substring(0, 20) + "..." : titleText;

            var $favicon = $('[rel="shortcut icon"]');
            var faviconURL;

            if ($favicon) {
                faviconURL = $favicon.attr('href');
                var origin = new URL(url).origin;
                var fullFaviconURL = new URL(faviconURL, origin);
            }

            callback(links, titleText, fullFaviconURL);
        })
        .catch((err) => {
            log(err);
        });

    return links;
}


//Queue implementation from http://code.iamkate.com/javascript/queues/
function Queue() {
    var a = [], b = 0;
    this.getLength = function () {
        return a.length - b
    };
    this.isEmpty = function () {
        return 0 == a.length
    };
    this.enqueue = function (b) {
        a.push(b)
    };
    this.pop_back = function () {
        return a.pop();
    }
    this.dequeue = function () {
        if (0 != a.length) {
            var c = a[b];
            2 * ++b >= a.length && (a = a.slice(b), b = 0);
            return c
        }
        return null;

    };
    this.peek = function () {
        return 0 < a.length ? a[b] : void 0
    }
};