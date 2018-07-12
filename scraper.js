
const rp = require('request-promise');
const cheerio = require('cheerio');


//constructor for WebLink object
function WebLink(url){
		this.url = url;
		this.webLinks = [];
}

//scraper API
module.exports = {
	scrape: function(url, responseCall){
		console.log("scraping: " + url);
		scrape(url, "", responseCall);
	}
	crawl: function(qry){
		//placeholder:
		qry = {url: "https://en.wikipedia.org/wiki/Main_Page", searchMethod: "DFS", stopKeyword: "Oregon", size: "10"};
		crawl(qry);
	}
};

//TODO: impliment BFS, DFS
function crawl(qry){

	//crawled urls to prevent loops
	var visited = [];
	visited.push( qry['url'] );

	var depth = parseInt( qry['size'] );

	var rootNode = new WebLink( qry['url']  )

	const method = qry['searchMethod'].toLowerCase();

	crawlHelper(rootNode, method, depth, visited);
}


function crawlHelper(node, method, depth, visited){
	
	if( depth <= 0 ) { return; }
	
	scrape(node.url, keyword, function( links ){
		//in bfs, add new node for each link
		if ( method == 'bfs'){
			for (link in links){
				if( !(link in visited) ){
					visited.push(link);
					node.webLinks.push( new WebLink(link) );
				}
//TODO: bfs needs to add links one layer at a time (to each node)
			}
		}	
		//in dfs, randomly choose link
		else {

			var index = Math.floor( Math.random() * links.length() );

			while( links.length > 0 links[index] in visited )
				links.splice(index, 1);
				index = Math.floor( Math.random() * links.length() )
			}

			if( links.length > 0 ){ 
				
				visited.push( links[index] );

				const childNode = new WebLink( links[index] ) 
				node.webLinks.push( childNode );
				crawlHelper(childNode, method, depth-1 visited)
			}
		}
	});
}

//webscraping reference: https://codeburst.io/an-introduction-to-web-scraping-with-node-js-1045b55c63f7
function scrape(url, keyword, callback){
	//options for request
	const options = {		
	  uri: url,
	  transform: function (body) {
	    return cheerio.load(body);
	  }
	};
  	
  	var links = [];

	//calls request, executes promise
	rp(options)
	  .then(($) => {
//TODO: impliment keyword stop
	    $('a').each( function(i, e){
	    	var link = $(this).attr('href')
	    	//if link is self
	    	if( link.substring(0,2) == './' ){
	    		link = url + link.substring(1);
	    	}

	    	if( link.startsWith('http') && !links.includes(link)){
	    		links.push(link);
	    	}
	    });
    	callback(links)
	  })
	  .catch((err) => {
	    console.log(err);
	  });

    return links;
}


