const pagelist = [
    'testpage',
    'testpage2'
];

const pagesCookieName = "pages-read";

function readPagesVisited() {
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === pagesCookieName) {
      return value.split(',');
    }
  }
  return null;
}

const pagesVisited = readPagesVisited() ?? [];

function writePagesVisited(pagesRead){
    var cookieBody = pagesRead.join(',');
    document.cookie = `${pagesCookieName}=${cookieBody}; max-age=34560000; SameSite=Lax`
}

// add (or move) the pageId to the front of the list
function addPageToVisited(pageId){
    var indexOf = pagesVisited.indexOf(pageId);
    if(indexOf > -1){
        pagesVisited.splice(indexOf, 1);
    }
    pagesVisited.unshift(pageId);
    writePagesVisited(pagesVisited);
}

function pickRandomPage(){
    const newpage = pagelist[Math.floor(Math.random() * pagelist.length)];
    var url = './page.html?p='+newpage;
    window.location.href = url;
}




